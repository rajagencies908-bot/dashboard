(() => {
'use strict';

const SESSION_KEY='raj_dashboard_session_token';
const DEVICE_KEY='raj_dashboard_device_id';
const USER_KEY='raj_dashboard_user';
const cfg=window.RAJ_CONFIG||{};
if(!window.supabase||!cfg.supabaseUrl||!cfg.supabasePublishableKey){alert('Supabase configuration not found.');return;}
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(Number(n||0));
let detected=null, groupRows=[];

function storedUser(){try{return JSON.parse(localStorage.getItem(USER_KEY)||'{}')||{};}catch{return {};}}
function isAdmin(){const u=storedUser();return String(u.role||u.user_role||'').toLowerCase()==='admin'||u.is_admin===true;}
function authArgs(extra={}){return {...extra,p_session_token:localStorage.getItem(SESSION_KEY)||'',p_device_id:localStorage.getItem(DEVICE_KEY)||''};}
async function rpc(name,args={}){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data;}
function toast(msg,error=false){const t=$('toast');t.textContent=msg;t.className='toast show'+(error?' error':'');clearTimeout(window.__stockToast);window.__stockToast=setTimeout(()=>t.className='toast',3500);}
function selectedValues(id){return [...$(id).selectedOptions].map(o=>o.value).filter(Boolean);}
function optionList(values,allLabel){return `<option value="">${allLabel}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');}
function esc(v){const d=document.createElement('div');d.textContent=v??'';return d.innerHTML;}
function num(v){if(v==null||v==='')return 0;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:0;}

async function guard(){
  const token=localStorage.getItem(SESSION_KEY),device=localStorage.getItem(DEVICE_KEY);
  if(!token||!device){location.href='index.html';return false;}
  try{const {data,error}=await sb.rpc('raj_app_validate_session',{p_session_token:token,p_device_id:device});if(error||data===false){location.href='index.html';return false;}}catch(e){console.warn('Session validation:',e.message);}
  return true;
}

async function loadFilters(){
  const [dates,divs]=await Promise.all([rpc('raj_stock_dates'),rpc('raj_stock_divisions')]);
  const dateVals=(dates||[]).map(x=>typeof x==='object'?x.stock_date:x).filter(Boolean);
  $('stockDate').innerHTML=dateVals.map(d=>`<option value="${d}">${d}</option>`).join('')||'<option value="">No stock uploaded</option>';
  const divVals=(divs||[]).map(x=>typeof x==='object'?x.division:x).filter(Boolean);
  $('stockDivision').innerHTML=optionList(divVals,'All Divisions');
}

async function loadGroups(){
  const rows=await rpc('raj_stock_group_summary',{p_stock_date:$('stockDate').value||null,p_divisions:selectedValues('stockDivision').filter(Boolean).length?selectedValues('stockDivision').filter(Boolean):null});
  groupRows=rows||[];
  const groups=groupRows.map(r=>r.item_group).filter(Boolean);
  const old=new Set(selectedValues('stockGroup'));
  $('stockGroup').innerHTML=optionList(groups,'All Companies / Groups');
  [...$('stockGroup').options].forEach(o=>{if(old.has(o.value))o.selected=true;});
  renderGroups();
}

function renderGroups(){
  const q=($('groupSearch').value||'').trim().toLowerCase();
  const chosen=new Set(selectedValues('stockGroup').filter(Boolean));
  const rows=groupRows.filter(r=>(!chosen.size||chosen.has(r.item_group))&&(!q||String(r.item_group||'').toLowerCase().includes(q)));
  $('groupBody').innerHTML=rows.length?rows.map(r=>`<tr><td><b>${esc(r.item_group)}</b></td><td>${fmt(r.total_part_nos)}</td><td>${fmt(r.total_stock_qty)}</td><td>${fmt(r.stock_part_nos)}</td><td>${fmt(r.zero_stock_part_nos)}</td><td>${fmt(r.min_zero_part_nos)}</td><td>${fmt(r.min_zero_stock_part_nos)}</td><td>${fmt(r.min_zero_stock_qty)}</td><td>${fmt(r.max_part_nos)}</td><td>${fmt(r.max_stock_qty)}</td></tr>`).join(''):'<tr><td colspan="10" class="empty">No matching stock data.</td></tr>';
}

async function loadSummary(){
  const groups=selectedValues('stockGroup').filter(Boolean),divs=selectedValues('stockDivision').filter(Boolean);
  const s=await rpc('raj_stock_summary',{p_stock_date:$('stockDate').value||null,p_divisions:divs.length?divs:null,p_item_groups:groups.length?groups:null});
  const x=s||{};
  $('kTotalParts').textContent=fmt(x.TotalPartNos);$('kTotalQty').textContent=fmt(x.TotalStockQty);$('kStockParts').textContent=fmt(x.StockPartNos);$('kZeroParts').textContent=fmt(x.ZeroStockPartNos);$('kMinZero').textContent=fmt(x.MinZeroPartNos);$('kMinZeroStock').textContent=fmt(x.MinZeroStockPartNos);$('kMinZeroQty').textContent=fmt(x.MinZeroStockQty);$('kMaxParts').textContent=fmt(x.MaxPartNos);$('kMaxQty').textContent=fmt(x.MaxStockQty);
  $('scopeText').textContent=`Stock Date: ${$('stockDate').value||'Latest'} • Stock Division: ${divs.length?divs.join(', '):'All'}`;
}

async function loadHistory(){
  const rows=await rpc('raj_stock_upload_history');
  $('historyBody').innerHTML=(rows||[]).map(r=>`<tr><td>${esc(r.stock_date)}</td><td><b>${esc(r.division)}</b></td><td>${esc(r.file_name||'')}</td><td>${fmt(r.total_rows)}</td><td>${esc(r.uploaded_by||'')}</td><td>${esc(r.uploaded_at?new Date(r.uploaded_at).toLocaleString('en-IN'):'')}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No uploads yet.</td></tr>';
}

async function refreshAll(){try{await loadFilters();await loadGroups();await loadSummary();await loadHistory();}catch(e){toast('Stock dashboard error: '+e.message,true);}}

function normHeader(v){return String(v??'').trim().replace(/\s+/g,' ');}
function findHeaderRow(rows){
  for(let i=0;i<Math.min(rows.length,30);i++){
    const h=(rows[i]||[]).map(normHeader);
    const lower=h.map(x=>x.toLowerCase());
    if(lower.includes('itemcode')&&lower.includes('itemgroup')&&h.some(x=>/\sClosingQty$/i.test(x)))return {index:i,headers:h};
  }
  return null;
}
function analyzeWorkbook(wb){
  const candidates=[];
  for(const sheetName of wb.SheetNames){
    const ws=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    const hit=findHeaderRow(rows);if(!hit)continue;
    const closing=hit.headers.find(h=>/\sClosingQty$/i.test(h));if(!closing)continue;
    const division=closing.replace(/\sClosingQty$/i,'').trim().toUpperCase();if(!division)continue;
    const need=[`${division} Rate`,`${division} Value`,`${division} MinQty`,`${division} MaxQty`];
    const lower=new Set(hit.headers.map(h=>h.toLowerCase()));
    if(!need.every(h=>lower.has(h.toLowerCase())))continue;
    candidates.push({sheetName,rows,headerIndex:hit.index,headers:hit.headers,division});
  }
  if(!candidates.length)throw new Error('No valid stock-data sheet found. Required headers: ItemGroup, ItemCode and <Division> ClosingQty/Rate/Value/MinQty/MaxQty.');
  if(candidates.length>1)throw new Error('More than one valid stock sheet found. Keep one stock-data sheet per workbook.');
  return candidates[0];
}
function mapRows(info){
  const H=info.headers, idx=name=>H.findIndex(h=>h.toLowerCase()===name.toLowerCase()), d=info.division;
  const ix={group:idx('ItemGroup'),code:idx('ItemCode'),desc:idx('ItemDescription'),unit:idx('Unit'),qty:idx(`${d} ClosingQty`),rate:idx(`${d} Rate`),value:idx(`${d} Value`),min:idx(`${d} MinQty`),max:idx(`${d} MaxQty`)};
  return info.rows.slice(info.headerIndex+1).map(r=>({item_group:String(r[ix.group]??'').trim(),item_code:String(r[ix.code]??'').trim(),item_description:String(r[ix.desc]??'').trim(),unit:String(r[ix.unit]??'').trim(),closing_qty:num(r[ix.qty]),rate:num(r[ix.rate]),stock_value:num(r[ix.value]),min_qty:num(r[ix.min]),max_qty:num(r[ix.max])})).filter(r=>r.item_code);
}
async function inspectFile(file){
  const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),info=analyzeWorkbook(wb),rows=mapRows(info);
  if(!rows.length)throw new Error('Valid stock sheet found, but no ItemCode rows were found.');
  return {...info,mappedRows:rows,file};
}

function openUpload(){if(!isAdmin()){toast('Stock upload is available to Admin only.',true);return;}$('uploadModal').classList.add('open');$('uploadModal').setAttribute('aria-hidden','false');$('uploadDate').value=new Date().toISOString().slice(0,10);}
function closeUpload(){if($('startUpload').disabled===false&&$('progressWrap').style.display==='block')return;$('uploadModal').classList.remove('open');$('uploadModal').setAttribute('aria-hidden','true');}

async function onFile(){
  detected=null;$('startUpload').disabled=true;$('detectBox').className='detect-box';
  const f=$('stockFile').files[0];if(!f){$('detectBox').textContent='Select a file to detect sheet and division.';return;}
  try{detected=await inspectFile(f);$('detectBox').className='detect-box ok';$('detectBox').innerHTML=`Valid stock sheet detected.<br><b>Sheet:</b> ${esc(detected.sheetName)} &nbsp; <b>Division:</b> ${esc(detected.division)} &nbsp; <b>Rows:</b> ${fmt(detected.mappedRows.length)}`;$('startUpload').disabled=false;}catch(e){$('detectBox').className='detect-box bad';$('detectBox').textContent=e.message;}
}

async function uploadStock(){
  if(!detected||!$('uploadDate').value)return;
  const u=storedUser(),uploadedBy=String(u.username??u.user_name??u.name??u.email??u.full_name??'Admin').trim()||'Admin';
  $('startUpload').disabled=true;$('cancelUpload').disabled=true;$('progressWrap').style.display='block';$('progressBar').style.width='25%';$('progressText').textContent=`Uploading ${fmt(detected.mappedRows.length)} rows for ${detected.division}…`;
  try{
    $('progressBar').style.width='45%';
    const result=await rpc('raj_stock_upload_json',{p_stock_date:$('uploadDate').value,p_division:detected.division,p_file_name:detected.file.name,p_uploaded_by:uploadedBy,p_rows:detected.mappedRows});
    $('progressBar').style.width='100%';$('progressText').textContent=`Completed: ${fmt(result?.rows||detected.mappedRows.length)} rows uploaded.`;toast(`${detected.division} stock uploaded successfully.`);
    await refreshAll();setTimeout(()=>{$('uploadModal').classList.remove('open');$('progressWrap').style.display='none';$('stockFile').value='';detected=null;$('detectBox').className='detect-box';$('detectBox').textContent='Select a file to detect sheet and division.';$('cancelUpload').disabled=false;},700);
  }catch(e){$('progressBar').style.width='0';$('progressText').textContent='Upload failed: '+e.message;$('cancelUpload').disabled=false;$('startUpload').disabled=false;toast('Upload failed: '+e.message,true);}
}

$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');$('uploadBtn').onclick=openUpload;$('closeUpload').onclick=closeUpload;$('cancelUpload').onclick=closeUpload;$('stockFile').onchange=onFile;$('startUpload').onclick=uploadStock;$('applyFilters').onclick=async()=>{await loadGroups();await loadSummary();};$('clearFilters').onclick=async()=>{[...$('stockDivision').options].forEach(o=>o.selected=false);[...$('stockGroup').options].forEach(o=>o.selected=false);await loadGroups();await loadSummary();};$('groupSearch').oninput=renderGroups;$('stockGroup').onchange=loadSummary;$('stockDate').onchange=async()=>{await loadGroups();await loadSummary();};$('stockDivision').onchange=async()=>{await loadGroups();await loadSummary();};

(async()=>{if(!await guard())return;if(!isAdmin())$('uploadBtn').style.display='none';await refreshAll();})();
})();
