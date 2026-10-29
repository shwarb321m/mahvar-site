/* MAHVAR public transport. No credentials. Public CMS: JSONP GET; leads: POST in a hidden iframe. */
(function(){
  'use strict';
  const url=String(window.MAHVAR_CONFIG&&window.MAHVAR_CONFIG.appsScriptUrl||'').trim();
  const valid=/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(url);
  const endpoint=url.split('?')[0];
  let inflight=null;
  const random=()=>{
    if(window.crypto&&crypto.randomUUID)return crypto.randomUUID().replace(/-/g,'');
    if(window.crypto&&crypto.getRandomValues){const b=new Uint8Array(16);crypto.getRandomValues(b);return [...b].map(v=>v.toString(16).padStart(2,'0')).join('');}
    return String(Date.now())+String(Math.random()).slice(2);
  };
  function getPublic(){
    if(!valid)return Promise.reject(new Error('لم يتم ضبط رابط Apps Script'));
    if(inflight)return inflight;
    inflight=new Promise((resolve,reject)=>{
      const name='MAHVAR_receive';
      let done=false;
      const script=document.createElement('script');
      const cleanup=()=>{clearTimeout(timer);delete window[name];script.remove();};
      const finish=(err,value)=>{if(done)return;done=true;cleanup();err?reject(err):resolve(value);};
      window[name]=(payload)=>{if(!payload||payload.ok!==true)finish(new Error('CMS response invalid'));
        else finish(null,payload.data);};
      script.onerror=()=>finish(new Error('تعذّر تحميل البيانات من Apps Script'));
      const timer=setTimeout(()=>finish(new Error('انتهت مهلة تحميل المحتوى')),12000);
      script.src=endpoint+'?action=public&callback='+name+'&t='+Date.now();
      document.head.appendChild(script);
    }).finally(()=>{inflight=null;});
    return inflight;
  }
  function submitLead(data){
    if(!valid)return Promise.reject(new Error('لم يتم ضبط رابط Apps Script'));
    return new Promise((resolve,reject)=>{
      const nonce=random(), frameName='mahvar_target_'+nonce;
      const frame=document.createElement('iframe');
      frame.name=frameName;frame.title='إرسال طلب محور';frame.hidden=true;
      frame.style.cssText='position:absolute;width:0;height:0;border:0;visibility:hidden';
      const form=document.createElement('form');form.method='POST';form.action=endpoint;form.target=frameName;
      form.acceptCharset='UTF-8';form.style.display='none';
      const fields={...data,action:'lead',nonce,requestId:random(),website:''};
      Object.entries(fields).forEach(([key,value])=>{
        const el=document.createElement('input');el.type='hidden';el.name=key;
        el.value=Array.isArray(value)?JSON.stringify(value):String(value??'');form.appendChild(el);
      });
      let done=false;
      const clean=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();frame.remove();};
      const finish=(error,result)=>{if(done)return;done=true;clean();error?reject(error):resolve(result);};
      const onMessage=e=>{
        if(e.source!==frame.contentWindow && !/^https:\/\/(?:[\w-]+\.)*(?:googleusercontent\.com|script\.google\.com)$/.test(e.origin))return;
        const m=e.data;
        if(!m||m.type!=='mahvar-lead'||m.nonce!==nonce)return;
        if(m.ok)finish(null,m);else finish(new Error(m.message||'رفض الخادم الطلب'));
      };
      const timer=setTimeout(()=>finish(new Error('انتهت مهلة تأكيد وصول الطلب')),25000);
      window.addEventListener('message',onMessage);
      document.body.appendChild(frame);document.body.appendChild(form);
      try{form.submit();}catch(e){finish(e);}
    });
  }
  window.MAHVAR_API={isConfigured:()=>valid,getPublic,submitLead};
})();
