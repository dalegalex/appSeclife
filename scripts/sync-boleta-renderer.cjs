const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../PSeclife/src/app/features/estudiante/pages/boletas/boletas-report.ts');
const target=path.resolve(__dirname,'../src/app/modules/calificaciones/boletas-report.generated.ts');
if(process.argv.includes('--check')){
 const bundled=fs.readFileSync(target,'utf8');
 if(!bundled.trim())throw new Error('Missing bundled boleta renderer');
 // Mac release builds use the versioned copy without requiring the portal checkout.
 if(fs.existsSync(source)){
  const normalize=text=>text.replace(/\r\n/g,'\n');
  if(normalize(bundled)!==normalize(fs.readFileSync(source,'utf8')))throw new Error('Boleta differs from PSeclife. Run node scripts/sync-boleta-renderer.cjs');
 }else console.log('Using versioned boleta renderer; PSeclife checkout not present.');
}else{
 const text=fs.readFileSync(source,'utf8');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);
}
