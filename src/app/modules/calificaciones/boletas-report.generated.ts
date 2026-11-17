export interface Student { idalumnoinscrito:number; matricula:string; alumno:string; idgpobase:number; grupo:string; grado:number; }
export interface Subject { idalumnoinscrito:number; idgpoasignatura:number; idasignatura:number; asignatura:string; tipo:string|null; idarea:number|null; area:string; ordenarea?:number|null; idorden?:number; }
export interface Cell { idalumnoinscrito:number; idgpoasignatura:number; idevalpdo:number; periodo:string; ordenperiodo:number; idcomponent:number; componente:string; valuetype:string; sitcalculado:boolean; ordencaptura:number; valor_numerico:number|null; valor_texto:string|null; valor_escala:string|null; }
export interface Attendance { idalumnoinscrito:number; mes:string; dias_clasificables:number|null; faltas:number|null; faltas_justificadas:number|null; retardos:number|null; retardos_justificados:number|null; }
export type AverageDecimalsKey='decimales_promedio_periodo'|'decimales_promedio_final_asignatura'|'decimales_promedio_bloque_periodo'|'decimales_promedio_general_bloque';
export interface BlockType {tipo:string|null;descripcion:string;orden:number;revision:number;mostrar_titulo_bloque:boolean;mostrar_encabezado_periodos:boolean;mostrar_encabezado_componentes:boolean;mostrar_promedio_periodo:boolean;mostrar_promedio_final_asignatura:boolean;mostrar_promedio_bloque_periodo:boolean;mostrar_promedio_general_bloque:boolean;decimales_promedio_periodo?:number;decimales_promedio_final_asignatura?:number;decimales_promedio_bloque_periodo?:number;decimales_promedio_general_bloque?:number;}
export const defaultBlock=(tipo:string|null):BlockType=>({tipo,descripcion:tipo===null?'General':`Bloque ${tipo}`,orden:0,revision:0,mostrar_titulo_bloque:true,mostrar_encabezado_periodos:true,mostrar_encabezado_componentes:true,mostrar_promedio_periodo:true,mostrar_promedio_final_asignatura:true,mostrar_promedio_bloque_periodo:true,mostrar_promedio_general_bloque:true,decimales_promedio_periodo:2,decimales_promedio_final_asignatura:2,decimales_promedio_bloque_periodo:2,decimales_promedio_general_bloque:2});
export interface ReportFormat {grado:number|null;notas_pie:string;mostrar_inasistencias:boolean|null;revision:number;inasistencias_ua?:boolean;}
export interface Report { idorg:number; idciclo:number; ciclo:string; unidad:string; emitido:string; alumnos:Student[]; asignaturas:Subject[]; componentes:Cell[]; asistencia:Attendance[]; tipos?:BlockType[]; formatos?:ReportFormat[]; }
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number=(v:number|null)=>v===null?'':new Intl.NumberFormat('es-MX',{maximumFractionDigits:2}).format(v);
export const averageText=(v:number|null,decimals=2)=>v===null?'':new Intl.NumberFormat('es-MX',{maximumFractionDigits:Number.isInteger(decimals)&&decimals>=0&&decimals<=2?decimals:2}).format(v);
export function mean(values:(number|null)[]):number|null {return !values.length||values.some(v=>v===null||!Number.isFinite(v))?null:(values as number[]).reduce((a,b)=>a+b,0)/values.length;}
export function periodResult(cells:Cell[]){const numeric=cells.filter(c=>c.valuetype==='NUMERIC');return {showAverage:numeric.length>=1,value:mean(numeric.map(c=>c.valor_numerico??null)),numeric:numeric.length};}
export function accumulatedMean(values:(number|null)[]):number|null {return mean(values.filter((v):v is number=>v!==null&&Number.isFinite(v)));}
const slot=(c:Cell)=>JSON.stringify([c.ordencaptura,c.componente,c.valuetype,c.sitcalculado]);
export const reportCss=`@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#172027;background:white;font:11px Arial,sans-serif;letter-spacing:0}article{padding:12px;break-after:page}article:last-child{break-after:auto}.heading{display:flex;align-items:center;gap:24px;min-height:75px;margin-bottom:22px}.logo{width:250px;max-height:80px;object-fit:contain}.title{flex:1;text-align:center;font-weight:bold;font-size:17px;line-height:1.4}.identity{display:flex;justify-content:space-between;gap:15px;margin:18px 0;font-size:12px}.identity div{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0 22px}th,td{border:1px solid #53616a;padding:5px 3px;overflow-wrap:anywhere;text-align:center}thead{display:table-header-group}tr{break-inside:avoid}th{background:#f0f2f4}.subject{width:23%;text-align:left}.area td{background:#555;color:white;text-align:left;font-weight:bold}.average{background:#dce6f6}.total td{font-weight:bold;background:#e5edf7}.block-title{font-size:12px;margin:12px 0 4px}.attendance{width:85%;font-size:10px}.attendance th:first-child{width:180px;text-align:left}.notes{font-size:10px;color:#48555b;margin:6px 0}.warning{color:#9b311f}.caption{font-size:9px;color:#53616a;text-align:right}@media screen{body{background:#e9edef}article{max-width:1120px;margin:12px auto;background:white;padding:30px;min-height:740px}}`;

export function renderBoletas(report:Report,logo:string|null,includeJustified:boolean):{html:string;pending:number;warnings:string[]}{
 let pending=0;
 const warnings=new Set<string>();
 const date=new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'}).format(new Date(report.emitido));
 const safeLogo=logo&&(/^(data:image\/(png|jpeg|webp);base64,)/i.test(logo)||/^https:\/\//i.test(logo))?logo:null;
 const pages=report.alumnos.map(student=>{
  const unitFormat=report.formatos?.find(f=>f.grado===null),gradeFormat=report.formatos?.find(f=>f.grado===student.grado);
  const showAttendance=gradeFormat?.mostrar_inasistencias??unitFormat?.mostrar_inasistencias??true;
  const footnotes=[unitFormat?.notas_pie,gradeFormat?.notas_pie].filter((n):n is string=>!!n?.trim());
  const subjects=report.asignaturas.filter(s=>s.idalumnoinscrito===student.idalumnoinscrito),cells=report.componentes.filter(c=>c.idalumnoinscrito===student.idalumnoinscrito);
  const periods=[...new Map(cells.map(c=>[c.idevalpdo,{id:c.idevalpdo,name:c.periodo,order:c.ordenperiodo}])).values()].sort((a,b)=>a.order-b.order||a.id-b.id);
  const blocks=new Map<string|null,Subject[]>();
  for(const s of subjects){if(!blocks.has(s.tipo))blocks.set(s.tipo,[]);blocks.get(s.tipo)!.push(s);}
  let tables='',previousSignature='',tableOpen=false;
  const config=(type:string|null)=>report.tipos?.find(t=>t.tipo===type)??defaultBlock(type);
  for(const [type,rows] of [...blocks].sort(([a],[b])=>config(a).orden-config(b).orden||config(a).descripcion.localeCompare(config(b).descripcion))){
   const settings=config(type);
   const ids=new Set(rows.map(s=>s.idgpoasignatura)),blockCells=cells.filter(c=>ids.has(c.idgpoasignatura));
   const headers=periods.map(p=>{
    const pc=blockCells.filter(c=>c.idevalpdo===p.id);
    const slots=[...new Map(pc.map(c=>[slot(c),c])).values()].sort((a,b)=>a.ordencaptura-b.ordencaptura||a.componente.localeCompare(b.componente));
    const avg=settings.mostrar_promedio_periodo&&rows.some(s=>periodResult(pc.filter(c=>c.idgpoasignatura===s.idgpoasignatura)).showAverage);
    return {...p,slots,avg,width:Math.max(1,slots.length)+(avg?1:0)};
   });
   const accumulated=settings.mostrar_promedio_final_asignatura;
   const totalColumns=1+headers.reduce((n,p)=>n+p.width,0)+(accumulated?1:0);
   const periodHead=`<tr><th class="subject">CAMPOS FORMATIVOS / ASIGNATURA</th>${headers.map(p=>`<th colspan="${p.width}">${esc(p.name)}</th>`).join('')}${accumulated?'<th class="average">PROMEDIO ACUMULADO</th>':''}</tr>`;
   const componentHead=`<tr><th class="subject"></th>${headers.map(p=>(p.slots.length?p.slots.map(c=>`<th>${esc(c.componente)}</th>`).join(''):'<th>Sin estructura</th>')+(p.avg?'<th class="average">PROMEDIO</th>':'')).join('')}${accumulated?'<th class="average"></th>':''}</tr>`;
   const visibleHead=(settings.mostrar_encabezado_periodos?periodHead:'')+(settings.mostrar_encabezado_componentes?componentHead:'');
   const head=visibleHead?`<thead>${visibleHead}</thead>`:'';
   const signature=JSON.stringify([headers.map(p=>[p.id,p.name,p.slots.map(slot),p.avg,p.width]),accumulated]);
   const wantsHidden=!settings.mostrar_encabezado_periodos||!settings.mostrar_encabezado_componentes;
   const shared=wantsHidden&&tableOpen&&signature===previousSignature;
   if(wantsHidden&&tableOpen&&!shared)warnings.add(`${settings.descripcion}: las columnas difieren del bloque anterior; revisa la correspondencia al ocultar sus encabezados.`);
   let areaId:number|null|undefined,body='';
   for(const s of [...rows].sort((a,b)=>(a.ordenarea??Number.MAX_SAFE_INTEGER)-(b.ordenarea??Number.MAX_SAFE_INTEGER)||a.area.localeCompare(b.area)||(a.idarea??Number.MAX_SAFE_INTEGER)-(b.idarea??Number.MAX_SAFE_INTEGER)||(a.idorden??0)-(b.idorden??0)||a.asignatura.localeCompare(b.asignatura))){
    if(s.idarea!==areaId){areaId=s.idarea;body+=`<tr class="area"><td colspan="${totalColumns}">${esc(s.area)}</td></tr>`;}
    body+=`<tr><th class="subject">${esc(s.asignatura)}</th>`;
    for(const p of headers){
     const values=blockCells.filter(c=>c.idevalpdo===p.id&&c.idgpoasignatura===s.idgpoasignatura);
     if(!values.length)pending++;
     if(!p.slots.length)body+='<td></td>';
     for(const col of p.slots){
      const found=values.filter(c=>slot(c)===slot(col));
      if(found.length>1)throw new Error('La estructura contiene componentes ambiguos; revisa su orden y descripcion.');
      const c=found[0],v=c?(c.valuetype==='NUMERIC'?number(c.valor_numerico??null):c.valuetype==='SCALE'?c.valor_escala:c.valor_texto):null;
      if(c&&(v===null||v===undefined||v===''))pending++;
      body+=`<td${!c?' style="background:#eef0f2"':''}>${esc(v)}</td>`;
     }
     const result=periodResult(values);if(p.avg)body+=`<td class="average">${result.showAverage?averageText(result.value,settings.decimales_promedio_periodo):''}</td>`;
    }
    if(accumulated){const result=accumulatedMean(headers.map(p=>periodResult(blockCells.filter(c=>c.idevalpdo===p.id&&c.idgpoasignatura===s.idgpoasignatura)).value));body+=`<td class="average accumulated">${averageText(result,settings.decimales_promedio_final_asignatura)}</td>`;}
    body+='</tr>';
   }
   const periodMeans=headers.map(p=>{
    if(rows.some(s=>!blockCells.some(c=>c.idevalpdo===p.id&&c.idgpoasignatura===s.idgpoasignatura)))return null;
    return mean(rows.map(s=>periodResult(blockCells.filter(c=>c.idevalpdo===p.id&&c.idgpoasignatura===s.idgpoasignatura))).filter(r=>r.numeric>0).map(r=>r.value));
   });
   if(settings.mostrar_promedio_bloque_periodo)body+=`<tr class="total"><td>PROMEDIO DEL BLOQUE</td>${headers.map((p,i)=>`<td colspan="${p.width}">${averageText(periodMeans[i],settings.decimales_promedio_bloque_periodo)}</td>`).join('')}${accumulated?'<td></td>':''}</tr>`;
   const general=mean(periodMeans);
   // Compatible blocks share one table: the browser repeats its real thead after a page break.
   if(!shared){if(tableOpen)tables+='</tbody></table>';tables+=`<table class="grades"><colgroup><col style="width:23%">${'<col>'.repeat(totalColumns-1)}</colgroup>${head}<tbody>`;tableOpen=true;previousSignature=signature;}
   if(settings.mostrar_titulo_bloque)tables+=`<tr class="block-heading"><td colspan="${totalColumns}"><h2 class="block-title">${esc(settings.descripcion)}</h2></td></tr>`;
   if(shared)tables+=(settings.mostrar_encabezado_periodos?periodHead:'')+(settings.mostrar_encabezado_componentes?componentHead:'');
   tables+=body;
   if(settings.mostrar_promedio_general_bloque)tables+=`<tr><td colspan="${totalColumns}" class="notes">Promedio general del bloque: <strong>${general===null?'Pendiente':averageText(general,settings.decimales_promedio_general_bloque)}</strong></td></tr>`;
  }
  if(tableOpen)tables+='</tbody></table>';
  if(!subjects.length){pending++;tables='<p class="warning">Sin asignaturas asociadas.</p>';}
  else if(!periods.length){pending++;tables+='<p class="warning">Sin componentes de evaluación aplicados.</p>';}
  const attendance=report.asistencia.filter(a=>a.idalumnoinscrito===student.idalumnoinscrito);
  const count=(a:Attendance,k:'faltas'|'retardos')=>a.dias_clasificables==null?'':String((a[k]??0)+(includeJustified?((k==='faltas'?a.faltas_justificadas:a.retardos_justificados)??0):0));
  const month=(v:string)=>new Intl.DateTimeFormat('es-MX',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(v.slice(0,10)+'T12:00:00Z'));
  const attendanceTable=showAttendance?`<table class="attendance"><thead><tr><th></th>${attendance.map(a=>`<th>${esc(month(a.mes))}</th>`).join('')}</tr></thead><tbody>${(['faltas','retardos'] as const).map(k=>`<tr><th>${k==='faltas'?'INASISTENCIAS MENSUALES':'RETARDOS'}</th>${attendance.map(a=>`<td>${count(a,k)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'';
  return `<article><header class="heading">${safeLogo?`<img class="logo" src="${esc(safeLogo)}" alt="Logotipo institucional">`:''}<div class="title">BOLETA INTERNA DE CALIFICACIONES<br>CICLO ESCOLAR ${esc(report.ciclo)}<br>(SIN VALIDEZ OFICIAL)</div></header><div class="identity"><div class="student-identity"><strong>ALUMNO:</strong> ${esc(student.alumno)}<br><strong>MATRÍCULA:</strong> ${esc(student.matricula)}</div><div>${esc(report.unidad)}<br><strong>GRADO:</strong> ${student.grado} · <strong>GRUPO BASE:</strong> ${esc(student.grupo)}</div></div>${tables}${attendanceTable}${footnotes.map(n=>`<p class="school-note">${esc(n)}</p>`).join('')}<p class="caption">Consulta al ${esc(date)}</p></article>`;
 }).join('');
 return {html:`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Boletas de calificaciones</title><style>${reportCss}.block-heading td{text-align:left}.block-heading h2{margin:3px 0}.student-identity{font-size:15px;line-height:1.45;flex:1;min-width:0}.logo{width:280px;max-width:32%;max-height:100px}.school-note{white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;line-height:1.35;margin:6px 0;orphans:2;widows:2}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{font-size:9px}article{padding:0}.heading{min-height:70px;margin-bottom:8px}.logo{max-height:75px;width:250px}.title{font-size:14px}.identity{font-size:10px;margin:10px 0}.student-identity{font-size:13px}table{margin:5px 0 8px}th,td{padding:2px}.block-title{font-size:10px;margin:7px 0 3px}.notes,.caption{font-size:8px;margin:4px 0}.school-note{font-size:9px}.attendance{font-size:9px;margin-top:12px}}</style></head><body>${pages}</body></html>`,pending,warnings:[...warnings]};
}
