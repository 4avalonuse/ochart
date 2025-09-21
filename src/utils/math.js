export const mean = (arr)=>{
  const xs = arr.filter(Number.isFinite);
  return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : undefined;
};
