// The isolated document uses the canonical report's print rules, not Ionic styles.
export async function createBoletaPdf(html: string): Promise<Blob> {
  return (await createBoletaDocument(html)).pdf;
}

export async function createBoletaDocument(html: string): Promise<{pdf:Blob;pages:string[]}> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:1047px;height:740px;border:0;pointer-events:none';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('No fue posible preparar la boleta.')), 15000);
      frame.onload = () => { clearTimeout(timer); resolve(); };
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
    const doc = frame.contentDocument!;
    const printRules: string[] = [];
    for (const sheet of Array.from(doc.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.type === CSSRule.MEDIA_RULE) {
          const media = rule as CSSMediaRule;
          if (media.conditionText === 'print') printRules.push(...Array.from(media.cssRules, r => r.cssText));
        } else if (rule.type !== CSSRule.PAGE_RULE) printRules.push(rule.cssText);
      }
    }
    doc.querySelectorAll('style').forEach(s => s.remove());
    const style = doc.createElement('style');
    style.textContent = printRules.join('\n') + '\nbody{width:277mm;background:white}article{margin:0;max-width:none;min-height:0}';
    doc.head.appendChild(style);
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images, image => image.decode()));
    // html2canvas does not reproduce object-fit; size the logo explicitly inside its box.
    for (const image of Array.from(doc.images)) {
      const rect=image.getBoundingClientRect();
      if(!image.naturalWidth||!image.naturalHeight)throw new Error('No fue posible cargar el logotipo.');
      const ratio=Math.min(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
      const box=doc.createElement('div');
      box.style.cssText=`width:${rect.width}px;height:${rect.height}px;flex:none;display:flex;align-items:center;justify-content:center`;
      image.replaceWith(box);box.appendChild(image);
      image.style.cssText=`width:${image.naturalWidth*ratio}px;height:${image.naturalHeight*ratio}px;max-width:none;max-height:none`;
    }
    if (doc.body.scrollHeight > 6000) throw new Error('La boleta excede el tamaño permitido para compartir.');
    for (const library of ['html2canvas.min.js', 'jspdf.umd.min.js']) {
      const script = doc.createElement('script');
      script.src = new URL('assets/pdf/' + library, document.baseURI).href;
      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('No fue posible cargar el generador PDF.')), 15000);
        script.onload = () => { clearTimeout(timer); resolve(); };
        script.onerror = () => reject(new Error('No fue posible cargar el generador PDF.'));
        doc.head.appendChild(script);
      });
    }
    const win = frame.contentWindow as any;
    const article = doc.querySelector('article')!;
    const bounds = article.getBoundingClientRect();
    const canvas: HTMLCanvasElement = await win.html2canvas(article, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 1047, scrollY: 0, scrollX: 0 });
    const pdfDocument = new win.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'landscape',compress:true});
    const scale = canvas.width / bounds.width;
    const rows = Array.from(article.querySelectorAll('tr,.heading,.identity,.school-note'), e => {
      const r = e.getBoundingClientRect();
      return {top:Math.floor((r.top-bounds.top)*scale),bottom:Math.ceil((r.bottom-bounds.top)*scale)};
    });
    const pageHeight = Math.floor(canvas.width * 190 / 277);
    const headers = Array.from(article.querySelectorAll('table'), table => {
      const tableRect=table.getBoundingClientRect(),head=table.querySelector('thead')?.getBoundingClientRect();
      return head?{top:Math.floor((head.top-bounds.top)*scale),bottom:Math.ceil((head.bottom-bounds.top)*scale),tableBottom:Math.ceil((tableRect.bottom-bounds.top)*scale)}:null;
    }).filter((h):h is {top:number;bottom:number;tableBottom:number}=>h!==null);
    const piece = doc.createElement('canvas');piece.width=canvas.width;
    const pages:string[]=[];
    const preview=doc.createElement('canvas');
    preview.width=Math.round(canvas.width*297/277);preview.height=Math.round(canvas.width*210/277);
    let start=0,page=0;
    while(start<canvas.height){
      const header=page?headers.find(h=>h.bottom<=start&&h.tableBottom>start):undefined;
      const headerHeight=header?header.bottom-header.top:0;
      let end=Math.min(start+pageHeight-headerHeight,canvas.height);
      // Move the page boundary before a row rather than cutting through its text.
      const crossing=rows.filter(r=>r.top<end&&r.bottom>end&&r.bottom>start);
      if(crossing.length)end=Math.min(...crossing.map(r=>r.top));
      if(end<=start)throw new Error('Un renglón de la boleta excede el alto de la página.');
      piece.height=end-start+headerHeight;
      const context=piece.getContext('2d')!;
      if(header)context.drawImage(canvas,0,header.top,canvas.width,headerHeight,0,0,piece.width,headerHeight);
      context.drawImage(canvas,0,start,canvas.width,end-start,0,headerHeight,piece.width,end-start);
      if(page++)pdfDocument.addPage();
      pdfDocument.addImage(piece.toDataURL('image/png'),'PNG',10,10,277,piece.height*277/piece.width,undefined,'FAST');
      const previewContext=preview.getContext('2d')!;
      previewContext.fillStyle='#ffffff';previewContext.fillRect(0,0,preview.width,preview.height);
      previewContext.drawImage(piece,canvas.width*10/277,canvas.width*10/277);
      pages.push(preview.toDataURL('image/png'));
      start=end;
    }
    const pdf: Blob = pdfDocument.output('blob');
    if (!pdf.size || pdf.size > 25 * 1024 * 1024) throw new Error('El PDF excede el tamaño permitido para compartir.');
    // Keep the Blob in the app's realm before destroying the rendering iframe.
    return {pdf:new Blob([pdf], {type:'application/pdf'}),pages};
  } finally { clearTimeout(timer); frame.remove(); }
}
