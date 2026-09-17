<?php
// OChart data endpoint.
// Cache is the normal path; refresh=1 explicitly bypasses it.

header('Content-Type: application/json; charset=utf-8');
header('X-Yahoo-Version: v5-trace');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

date_default_timezone_set('UTC');
ini_set('display_errors', '0');
error_reporting(E_ERROR | E_PARSE);

$__TRACE = []; $__WARN = []; $__DONE = false;
function t($s, $extra=null){ global $__TRACE; $__TRACE[] = ['t'=>microtime(true), 's'=>$s, 'extra'=>$extra]; }
set_error_handler(function($errno,$errstr,$errfile,$errline){
  global $__WARN; $__WARN[] = "{$errstr} @ {$errfile}:{$errline}";
  return true;
});
ob_start();

register_shutdown_function(function(){
  global $__DONE, $__TRACE, $__WARN;
  if ($__DONE) return;
  $out = ob_get_clean();
  $err = error_get_last();
  http_response_code(500);
  @header('X-Cache: BYPASS');
  @header('X-Cache-Age: 0');
  @header('X-Cache-TTL: 0');
  echo json_encode([
    'ok'=>false,
    'error'=>'shutdown',
    'fatal'=> $err ? $err['message'] : 'shutdown',
    'stray'=>$out,
    'meta'=>['trace'=>$__TRACE, 'warnings'=>$__WARN]
  ], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
});

function finish($payload, $status=200, $hdrs = []){
  global $__DONE;
  $__DONE = true;
  http_response_code($status);
  if (ob_get_level()) @ob_clean();
  foreach ($hdrs as $k => $v){
    if ($v === null) continue;
    @header($k.': '.$v);
  }
  echo json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}
function num($x){ return is_numeric($x) ? floatval($x) : null; }
function safeKey($s){ return preg_replace('/[^a-zA-Z0-9_\\-\\.]+/','-', $s); }
function normalizeInterval($i){ if ($i==='1h') return '60m'; if ($i==='1w') return '1wk'; return $i; }
function defaultRange($interval){
  $i = normalizeInterval($interval);
  switch ($i) {
    case '60m': return '3mo';
    case '1d':
    case '1wk':
    case '1mo': return 'max';
    default: return '1mo';
  }
}
function ttlFor($interval){
  if ($interval==='60m') return 300;
  if ($interval==='1d')  return 900;
  if ($interval==='1wk') return 3600;
  if ($interval==='1mo') return 21600;
  return 900;
}
function httpJson($url){
  $ua = 'Mozilla/5.0 OChart/0.4.1';
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 12,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_HTTPHEADER => [
      'Accept: application/json',
      'User-Agent: '.$ua,
      'Accept-Language: en-US,en;q=0.9'
    ],
  ]);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  if ($res === false || $code < 200 || $code >= 300)
    throw new Exception('curl_fail code='.$code.' err='.($err?:'none'));
  $json = json_decode($res, true);
  if (!$json) throw new Exception('json_decode_fail');
  return $json;
}
function validateYahoo($raw){
  if (!empty($raw['chart']['error'])) throw new Exception('yahoo_upstream_error');
  $r = $raw['chart']['result'][0] ?? null;
  if (!$r) throw new Exception('yahoo_no_result');
  $ts = $r['timestamp'] ?? [];
  if (!is_array($ts) || !count($ts)) throw new Exception('yahoo_no_timestamps');
}
function normalizeYahoo($raw, $symbol, $interval){
  $r = $raw['chart']['result'][0];
  $q = $r['indicators']['quote'][0] ?? [];
  $ts = $r['timestamp'] ?? [];
  $o=$q['open']??[]; $h=$q['high']??[]; $l=$q['low']??[]; $c=$q['close']??[]; $v=$q['volume']??[];
  $data=[]; $N=count($ts);
  for($i=0;$i<$N;$i++){
    $data[]=[
      't'=>intval($ts[$i])*1000,
      'o'=>num($o[$i]??null),
      'h'=>num($h[$i]??null),
      'l'=>num($l[$i]??null),
      'c'=>num($c[$i]??null),
      'v'=>num($v[$i]??null)
    ];
  }
  return [
    'meta'=>[
      'symbol'=>$symbol,
      'interval'=>$interval,
      'fetchedAt'=>round(microtime(true)*1000)
    ],
    'data'=>$data
  ];
}
function metaGranularity($raw){ return $raw['chart']['result'][0]['meta']['dataGranularity'] ?? null; }
function canonicalGranularity($g){
  if(!$g) return null;
  $g=strtolower($g);
  return $g==='1w' ? '1wk' : $g;
}
function metaFirstTrade($raw){ return $raw['chart']['result'][0]['meta']['firstTradeDate'] ?? null; }
function hdrsFromMeta($args){
  $def=[
    'X-Cache'=>'MISS','X-Cache-Age'=>0,'X-Cache-TTL'=>0,
    'X-Interval'=>null,'X-Range'=>null,'X-Granularity'=>null,
    'X-Interval-Actual'=>null,'X-Range-Adjusted'=>0,'X-Sanitized'=>0
  ];
  $out=array_merge($def,$args);
  foreach(['X-Range-Adjusted','X-Sanitized'] as $k) $out[$k]=$out[$k]?'1':'0';
  foreach(['X-Cache-Age','X-Cache-TTL'] as $k) $out[$k]=(int)$out[$k];
  return $out;
}

t('start');

$symbol=$_GET['symbol']??'BTC-USD';
$interval=$_GET['interval']??'1d';
$range=$_GET['range']??defaultRange($interval);
$startArg=$_GET['start']??null;
$endArg=$_GET['end']??null;
$sanQ=$_GET['sanitized']??'1';
$pos=$_GET['pos']??'1';
$traceQ=$_GET['trace']??'1';
$refresh=filter_var($_GET['refresh']??'0', FILTER_VALIDATE_BOOLEAN);

$allowedSymbols=['BTC-USD'];
$allowedIntervals=['1h','60m','1d','1wk','1w','1mo'];

if(!in_array($symbol,$allowedSymbols))
  finish(['ok'=>false,'error'=>'param_symbol_not_allowed','meta'=>['trace'=>$__TRACE,'warnings'=>$__WARN]],400,hdrsFromMeta(['X-Cache'=>'BYPASS']));
if(!in_array($interval,$allowedIntervals))
  finish(['ok'=>false,'error'=>'param_interval_not_allowed','meta'=>['trace'=>$__TRACE,'warnings'=>$__WARN]],400,hdrsFromMeta(['X-Cache'=>'BYPASS']));

$yInterval=normalizeInterval($interval);
$rangeIn=$range;
$period1=null; $period2=null; $usedPeriod=false; $rangeAdjusted=false;

if($startArg!==null||$endArg!==null){
  $p1=is_numeric($startArg)?intval($startArg):strtotime($startArg);
  $p2=is_numeric($endArg)?intval($endArg):strtotime($endArg);
  $period1=$p1?:null; $period2=$p2?:null;
  if($period1&&$period2&&$period2<=$period1) $period2=$period1+60;
  $usedPeriod=true;
}
t('params',compact('symbol','interval','yInterval','range','period1','period2','sanQ','pos','refresh'));

$cacheDir=__DIR__.DIRECTORY_SEPARATOR.'cache';
if(!is_dir($cacheDir)) @mkdir($cacheDir,0777,true);
$cacheKey=$usedPeriod
  ? safeKey($symbol.'_'.$yInterval.'_p'.$period1.'_'.$period2).'.json'
  : safeKey($symbol.'_'.$yInterval.'_'.$range).'.json';
$cacheFile=$cacheDir.DIRECTORY_SEPARATOR.$cacheKey;
$ttl=ttlFor($yInterval);
$now=time();

t('cache_check',[
  'file'=>$cacheFile,
  'exists'=>file_exists($cacheFile),
  'age'=>file_exists($cacheFile)?($now-@filemtime($cacheFile)):null,
  'ttl'=>$ttl,
  'refresh'=>$refresh
]);

// Normal requests may use a fresh server cache.
// Explicit refresh always goes upstream first.
if(!$refresh && is_file($cacheFile) && ($now-@filemtime($cacheFile)<$ttl)){
  t('cache_hit');
  $payload=json_decode(@file_get_contents($cacheFile),true);
  if(!$payload) $payload=['meta'=>[],'data'=>[]];
  $payload['ok']=true;
  $payload['meta']=is_array($payload['meta']??null)?$payload['meta']:[];
  $payload['meta']['cache']='HIT';
  $payload['meta']['trace']=$traceQ?$__TRACE:null;
  $payload['meta']['warnings']=$__WARN;

  $age=max(0,$now-(int)@filemtime($cacheFile));
  finish($payload,200,hdrsFromMeta([
    'X-Cache'=>'HIT','X-Cache-Age'=>$age,'X-Cache-TTL'=>$ttl,
    'X-Interval'=>$payload['meta']['interval']??$yInterval,
    'X-Range'=>$payload['meta']['range_in']??$rangeIn,
    'X-Granularity'=>$payload['meta']['granularity']??null,
    'X-Interval-Actual'=>$payload['meta']['interval_actual']??$yInterval,
    'X-Range-Adjusted'=>!empty($payload['meta']['range_adjusted']),
    'X-Sanitized'=>!empty($payload['meta']['sanitized'])
  ]));
}

try{
  t($usedPeriod?'fetch_period':'fetch_range_try',['interval'=>$yInterval,'range'=>$rangeIn,'refresh'=>$refresh]);
  $base='https://query1.finance.yahoo.com/v8/finance/chart/'.urlencode($symbol);
  $query=$usedPeriod
    ? ['interval'=>$yInterval,'period1'=>$period1,'period2'=>$period2]
    : ['interval'=>$yInterval,'range'=>$rangeIn];
  $raw=httpJson($base.'?'.http_build_query($query));

  if(!$usedPeriod){
    $gran=canonicalGranularity(metaGranularity($raw));
    if(in_array($yInterval,['1d','1wk'],true)&&strtolower($rangeIn)==='max'&&$gran!==$yInterval){
      t('granularity_fix',['wanted'=>$yInterval,'got'=>$gran]);
      $first=metaFirstTrade($raw)?: (time()-365*10*86400);
      $raw=httpJson($base.'?'.http_build_query([
        'interval'=>$yInterval,'period1'=>$first,'period2'=>time()
      ]));
      $rangeAdjusted=true;
    }
  }

  t('fetch_ok');
  validateYahoo($raw);

  $pack=normalizeYahoo($raw,$symbol,$yInterval);
  $pack['ok']=true;
  $pack['meta']['cache']=$refresh?'BYPASS':'MISS';
  $pack['meta']['interval_in']=$yInterval;
  $pack['meta']['range_in']=$rangeIn;
  $pack['meta']['granularity']=metaGranularity($raw);
  $pack['meta']['interval_actual']=canonicalGranularity($pack['meta']['granularity']??$yInterval);
  $pack['meta']['range_adjusted']=$rangeAdjusted;
  $pack['meta']['refresh']=$refresh;

  $in=$pack['data'];
  $report=['input'=>count($in),'droppedInvalid'=>0,'fixedOHLC'=>0,'negOrNaNVolToZero'=>0];
  $out=[];
  foreach($in as $p){
    $o=$p['o'];$h=$p['h'];$l=$p['l'];$c=$p['c'];$v=$p['v'];
    if($o===null||$h===null||$l===null||$c===null||$o<=0||$h<=0||$l<=0||$c<=0){$report['droppedInvalid']++;continue;}
    $low=min($o,$h,$l,$c);$high=max($o,$h,$l,$c);
    if($low!=$l||$high!=$h){$l=$low;$h=$high;$report['fixedOHLC']++;}
    if(!is_numeric($v)||$v<0){$v=0;$report['negOrNaNVolToZero']++;}
    $out[]=['t'=>$p['t'],'o'=>$o,'h'=>$h,'l'=>$l,'c'=>$c,'v'=>$v];
  }
  $pack['data']=$out;
  $pack['meta']['sanitized']=true;
  $pack['meta']['sanitize_report']=$report;

  try{
    @file_put_contents($cacheFile,json_encode($pack,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
    @touch($cacheFile,time());
    t('cache_saved');
  }catch(Exception $w){
    $GLOBALS['__WARN'][]='cache_write_failed: '.$w->getMessage();
  }

  $pack['meta']['trace']=$traceQ?$__TRACE:null;
  $pack['meta']['warnings']=$__WARN;

  finish($pack,200,hdrsFromMeta([
    'X-Cache'=>$refresh?'BYPASS':'MISS',
    'X-Cache-Age'=>0,'X-Cache-TTL'=>$ttl,
    'X-Interval'=>$yInterval,'X-Range'=>$rangeIn,
    'X-Granularity'=>$pack['meta']['granularity']??null,
    'X-Interval-Actual'=>$pack['meta']['interval_actual']??$yInterval,
    'X-Range-Adjusted'=>$rangeAdjusted,'X-Sanitized'=>true
  ]));
}catch(Exception $e){
  t('fetch_fail',['msg'=>$e->getMessage()]);
  finish([
    'ok'=>false,'error'=>'fetch_failed','message'=>$e->getMessage(),
    'meta'=>[
      'trace'=>$__TRACE,'warnings'=>$__WARN,
      'params'=>[
        'symbol'=>$symbol,'interval'=>$interval,'yInterval'=>$yInterval,
        'range'=>$rangeIn,'usePeriod'=>$usedPeriod,'period1'=>$period1,'period2'=>$period2,
        'refresh'=>$refresh
      ]
    ]
  ],500,hdrsFromMeta([
    'X-Cache'=>'BYPASS','X-Cache-Age'=>0,'X-Cache-TTL'=>0,
    'X-Interval'=>$yInterval,'X-Range'=>$rangeIn,'X-Sanitized'=>0
  ]));
}
