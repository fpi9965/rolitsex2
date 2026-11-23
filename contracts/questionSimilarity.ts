import { masterStages } from "./cards";
import { secretPrompts } from "./secret";

type Used = Record<string, number[]>;
const filler = new Set(["لو","هل","وش","ما","في","من","على","عن","او","ولا","انت","انتي","انا","هو","هي","لك","لي","مع","معي","عند","عندي","تبي","تبين","تحب","تحبين","تفضل","تفضلين","اللي","اذا","كان","كنت","ان","انك","اني","هذا","هذه","ذا","ذي","شي","شيء","اكثر","وقت","قبل","بعد"]);
export function tokens(value: string): Set<string> {
  return new Set(value.normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/[^\u0621-\u064a\s]/g," ").split(/\s+/).filter(w=>w.length>2&&!filler.has(w)));
}
export function similar(a: string, b: string): boolean {
  const x=tokens(a),y=tokens(b);
  if (x.size<3||y.size<3) return false;
  const common=[...x].filter(t=>y.has(t)).length;
  return common/Math.min(x.size,y.size)>=0.78 && common>=3;
}
function cardText(stage:number,index:number): string[] {
  const c=masterStages[stage]?.[index];
  return c?[c["مذكر"],c["مؤنث"]]:[];
}
export function overlapsUsedCard(stage:number,index:number,history:Used):boolean {
  const current=cardText(stage,index);
  return Object.entries(history).some(([s,indices])=>indices.some(i=>
    current.some(a=>cardText(Number(s),i).some(b=>similar(a,b)))
  ));
}
export function overlapsUsedSecret(stage:number,index:number,history:Used):boolean {
  const p=secretPrompts[stage]?.[index]; if(!p)return false;
  return Object.entries(history).some(([s,indices])=>indices.some(i=>{
    const old=secretPrompts[Number(s)]?.[i];
    return old&&([p["مذكر"],p["مؤنث"]].some(a=>[old["مذكر"],old["مؤنث"]].some(b=>similar(a,b))));
  }));
}
