const {createClient}=supabase;
const sb=createClient(RAJ_CONFIG.supabaseUrl,RAJ_CONFIG.supabasePublishableKey);

const filterDefs=[
['MainGrp','Main Group','All Main Groups'],
['ItemGroup','Item Group','All Item Groups'],
['Party','Customer / Party','All Customers'],
['ItemCode','Item Code','All Item Codes'],
['ItemName','Product / Item Name','All Products'],
['SM','SM','All SM'],
['Division','Division','All Divisions'],
['City','City','All Cities'],
['Pincode','Pincode','All Pincodes']
];

const filters=filterDefs.map(x=>x[0]),selected={};
filters.forEach(f=>selected[f]=[]);
selected.month=[];

let columns=[],months=[],page=1,totalPages=1,currentView='Party',
timer=null,budgetTimer=null,budgetPage=1,budgetRows=[],budgetPageSize=25;

const fmt=n=>new Intl.NumberFormat('en-IN',{
  maximumFractionDigits:2
}).format(Number(n||0));

const money=n=>'₹'+new Intl.NumberFormat('en-IN',{
  minimumFractionDigits:2,
  maximumFractionDigits:2
}).format(Number(n||0));

const esc=v=>{
  const d=document.createElement('div');
  d.textContent=v??'';
  return d.innerHTML
};

const monthNames={
Jan:'January',Feb:'February',Mar:'March',
Apr:'April',May:'May',Jun:'June',June:'June',
Jul:'July',July:'July',Aug:'August',
Sep:'September',Sept:'September',
Oct:'October',Nov:'November',Dec:'December'
};

const budgetMonthMap={
Apr:['AprBudget','AprSales','AprDiff'],
May:['MayBudget','MaySales','MayDiff'],
Jun:['JuneBudget','JuneSales','JuneDiff'],
June:['JuneBudget','JuneSales','JuneDiff'],
Jul:['JulyBudget','JulySales','JulyDiff'],
July:['JulyBudget','JulySales','JulyDiff'],
Aug:['AugBudget','AugSales','AugDiff'],
Sep:['SepBudget','SepSales','SepDiff'],
Sept:['SepBudget','SepSales','SepDiff']
};

const args=()=>({
  p_filters:Object.fromEntries(
    filters.filter(c=>selected[c].length).map(c=>[c,selected[c]])
  ),
  p_months:selected.month,
  p_sale_status:document.getElementById('productSaleStatus').value,
  p_search:document.getElementById('search').value.trim()
});

const budgetArgs=()=>({
  p_sms:selected.SM.length?selected.SM:null,
  p_cities:selected.City.length?selected.City:null,
  p_pincodes:selected.Pincode.length?selected.Pincode:null,
  p_divisions:selected.Division.length?selected.Division:null,
  p_parties:selected.Party.length?selected.Party:null,

  p_ods:document.getElementById('budgetOD').value.trim()
    ?[document.getElementById('budgetOD').value.trim()]
    :null,

  p_target_mode:document.getElementById('budgetTarget').value,
  p_status:document.getElementById('budgetStatus').value,

  p_months:selected.month.length?selected.month:null
});

async function rpc(n,a={}){
  const {data,error}=await sb.rpc(n,a);
  if(error)throw error;
  return data
}

function buildFilterUI(){
  document.getElementById('filterGrid').innerHTML=
  filterDefs.map(([id,l,all])=>`
  <div class="field">
    <label>${l}</label>

    <div class="multi" id="multi_${id}">
      <button type="button" class="multi-btn" data-open="${id}">
        <span id="label_${id}">${all}</span>
        <span>▾</span>
      </button>

      <div class="multi-menu">
        <input class="multi-search"
               id="search_${id}"
               placeholder="Search ${l}...">

        <div class="multi-options"
             id="options_${id}"></div>
      </div>
    </div>

    <div class="selected-chips"
         id="chips_${id}"></div>
  </div>
  `).join('')
}

function buildMonths(){
  const b=document.getElementById('options_month');

  b.innerHTML=months.map(m=>`
  <label class="multi-option"
         data-text="${esc((monthNames[m]||m).toLowerCase())}">
    <input type="checkbox" value="${esc(m)}">
    <span>${esc(monthNames[m]||m)}</span>
  </label>
  `).join('');

  b.querySelectorAll('input').forEach(c=>
    c.onchange=()=>{
      c.checked
        ?(!selected.month.includes(c.value)&&selected.month.push(c.value))
        :selected.month=selected.month.filter(x=>x!==c.value);

      updateMonthLabel();

      page=1;
      budgetPage=1;

      loadDashboard(true);
    }
  )
}

function updateMultiLabel(c){
  const d=filterDefs.find(x=>x[0]===c);

  document.getElementById('label_'+c).textContent=
    selected[c].length
      ?`${selected[c].length} selected`
      :d[2];

  document.getElementById('chips_'+c).innerHTML=
    selected[c].slice(0,4)
      .map(v=>`<span class="chip">${esc(v)}</span>`)
      .join('')
    +(selected[c].length>4
      ?`<span class="chip">+${selected[c].length-4}</span>`
      :'');
}

function updateMonthLabel(){
  document.getElementById('label_month').textContent=
    selected.month.length
      ?`${selected.month.length} selected`
      :'All Months / Total';

  document.getElementById('chips_month').innerHTML=
    selected.month
      .map(v=>`<span class="chip">${esc(monthNames[v]||v)}</span>`)
      .join('');
}

async function loadFilter(c){
  const data=await rpc('raj_filter_values',{
    p_column:c,
    ...args()
  });

  const b=document.getElementById('options_'+c);

  b.innerHTML=(data||[]).map(v=>`
    <label class="multi-option"
           data-text="${esc(String(v).toLowerCase())}">
      <input type="checkbox"
             value="${esc(v)}"
             ${selected[c].includes(String(v))?'checked':''}>
      <span>${esc(v)}</span>
    </label>
  `).join('');

  b.querySelectorAll('input').forEach(x=>
    x.onchange=()=>{
      x.checked
        ?(!selected[c].includes(x.value)&&selected[c].push(x.value))
        :selected[c]=selected[c].filter(v=>v!==x.value);

      updateMultiLabel(c);

      page=1;
      budgetPage=1;

      loadDashboard(true);
    }
  )
}

async function refreshFilters(){
  for(const c of filters)await loadFilter(c)
}

function renderMonths(m){
  document.getElementById('monthlyCards').innerHTML=
  months.map(x=>{
    const a=m?.[x]||{};

    return `
    <div class="month-card">
      <h4>${esc(monthNames[x]||x)}</h4>

      <div class="metric">
        <span>Qty</span>
        <b>${fmt(a.Qty)}</b>
      </div>

      <div class="metric">
        <span>Taxable</span>
        <b>${money(a.Taxable)}</b>
      </div>

      <div class="metric">
        <span>Sale</span>
        <b>${money(a.Sale)}</b>
      </div>

      <div class="metric">
        <span>Products Sold</span>
        <b>${fmt(a.ProductsSold)}</b>
      </div>

      <div class="metric">
        <span>Customers Billed</span>
        <b>${fmt(a.CustomersBilled)}</b>
      </div>
    </div>
    `
  }).join('')
}

function renderRows(rows){
  const b=document.getElementById('tableBody');

  if(!rows?.length){
    b.innerHTML=`
      <tr>
        <td class="empty"
            colspan="${columns.length}">
          No matching data found.
        </td>
      </tr>`;
    return
  }

  b.innerHTML=rows.map(r=>
    '<tr>'+
    columns.map(c=>
      `<td>${
        esc(
          /Qty|Taxable|Amt|Sale$/.test(c)
            ?fmt(r[c])
            :(r[c]??'')
        )
      }</td>`
    ).join('')
    +'</tr>'
  ).join('')
}

async function loadGroupSummary(){
  const d=await rpc('raj_group_summary',{
    p_view:currentView,
    ...args()
  });

  const b=document.getElementById('groupSummaryBody');

  if(!d?.length){
    b.innerHTML=
      '<tr><td class="empty" colspan="7">No summary data found.</td></tr>';
    return
  }

  b.innerHTML=d.map(x=>`
    <tr>
      <td>${esc(x.label)}</td>
      <td>${fmt(x.qty)}</td>
      <td>${money(x.taxable)}</td>
      <td>${money(x.sale)}</td>
      <td>${fmt(x.productsSold)}</td>
      <td>${fmt(x.customersBilled)}</td>
      <td>${fmt(x.records)}</td>
    </tr>
  `).join('')
}

function budgetMonthsToShow(){
  const chosen=selected.month.length
    ?selected.month
    :months;

  const normalized=[];

  for(const m of chosen){
    const key=
      m==='Sept'?'Sep':
      m==='June'?'Jun':
      m==='July'?'Jul':
      m;

    if(budgetMonthMap[key]&&!normalized.includes(key))
      normalized.push(key);
  }

  return normalized
}

function diffClass(n){
  return Number(n||0)<0
    ?'budget-negative'
    :'budget-positive'
}

function renderBudget(){

  const panel=document.getElementById('budgetPanel');

  /*
   Customer Budget Company Wise અને Product Wiseમાં
   apply કરવાનું નથી.
  */
  if(currentView==='MainGrp'||currentView==='ItemName'){
    panel.classList.add('budget-hidden');
    return
  }else{
    panel.classList.remove('budget-hidden');
  }

  const showMonths=budgetMonthsToShow();
  const multiSelected=selected.month.length>1;

  let head=
    '<th>SM</th>'+
    '<th>Customer / Party</th>'+
    '<th>Target</th>'+
    '<th>OD</th>';

  showMonths.forEach(m=>{
    const name=monthNames[m]||m;

    head+=
      `<th>${name} Sales</th>`+
      `<th>${name} Budget</th>`+
      `<th>${name} Diff</th>`;
  });

  if(multiSelected||!selected.month.length){
    head+=
      '<th>Total Sales</th>'+
      '<th>Total Budget</th>'+
      '<th>Total Diff</th>'+
      '<th>Achievement %</th>'+
      '<th>Status</th>';
  }

  budgetTableHead.innerHTML=head;

  budgetCount.textContent=fmt(budgetRows.length);

  const totalPages=
    Math.max(1,Math.ceil(budgetRows.length/budgetPageSize));

  budgetPage=Math.min(budgetPage,totalPages);

  const rows=budgetRows.slice(
    (budgetPage-1)*budgetPageSize,
    budgetPage*budgetPageSize
  );

  if(!rows.length){

    budgetTableBody.innerHTML=`
      <tr>
        <td class="empty"
            colspan="${4+showMonths.length*3+5}">
          No matching budget customers found.
        </td>
      </tr>`;

  }else{

    budgetTableBody.innerHTML=rows.map(r=>{

      let cells=
        `<td>${esc(r.SalesMan||'')}</td>`+
        `<td>${esc(r.Party||'')}</td>`+
        `<td>${esc(r.Target||'')}</td>`+
        `<td>${esc(r.Order||'')}</td>`;

      showMonths.forEach(m=>{

        const [bk,sk,dk]=budgetMonthMap[m];

        cells+=
          `<td>${money(r[sk])}</td>`+
          `<td>${money(r[bk])}</td>`+
          `<td class="${diffClass(r[dk])}">
             ${money(r[dk])}
           </td>`;
      });

      if(multiSelected||!selected.month.length){

        cells+=
          `<td>${money(r.SelectedSales)}</td>`+
          `<td>${money(r.SelectedBudget)}</td>`+
          `<td class="${diffClass(r.Difference)}">
             ${money(r.Difference)}
           </td>`+
          `<td>${fmt(r.AchievementPct)}%</td>`+
          `<td>
             <span class="budget-status ${
               r.BudgetStatus==='ACHIEVED'?'ok':'bad'
             }">
               ${esc(r.BudgetStatus||'')}
             </span>
           </td>`;
      }

      return `<tr>${cells}</tr>`

    }).join('');
  }

  budgetPageInfo.textContent=
    `Page ${budgetPage} of ${totalPages} • ${fmt(budgetRows.length)} customers`;

  budgetPrev.disabled=budgetPage<=1;
  budgetNext.disabled=budgetPage>=totalPages;

  budgetNote.textContent=
    selected.month.length
      ?`Showing ${
          selected.month.map(m=>monthNames[m]||m).join(', ')
        } budget vs actual sales.`
      :'No month selected: showing all available months side-by-side.';
}

async function loadBudget(){

  if(currentView==='MainGrp'||currentView==='ItemName'){
    renderBudget();
    return
  }

  budgetLoading.classList.add('show');

  try{

    budgetRows=
      await rpc(
        'raj_customer_budget_report',
        budgetArgs()
      )||[];

    renderBudget();

  }catch(e){

    console.error(e);

    budgetTableBody.innerHTML=
      `<tr>
        <td class="empty">
          Budget error: ${esc(e.message)}
        </td>
      </tr>`;

  }finally{

    budgetLoading.classList.remove('show');
  }
}

async function loadDashboard(reload=false){

  document.getElementById('loading')
    .classList.add('show');

  try{

    const a=args();

    const [s,r]=await Promise.all([

      rpc('raj_dashboard_summary',a),

      rpc('raj_dashboard_rows',{
        ...a,
        p_page:page,
        p_page_size:Number(
          document.getElementById('pageSize').value
        )
      })

    ]);

    const x=s.summary||{};

    totalQty.textContent=fmt(x.TotalQty);
    totalTaxable.textContent=money(x.TotalTaxable);
    totalSale.textContent=money(x.TotalSale);

    productsSold.textContent=
      fmt(x.ProductsSold);

    customersBilled.textContent=
      fmt(x.CustomersBilled);

    recordCount.textContent=
      fmt(r.totalRows);

    renderMonths(s.monthly);
    renderRows(r.rows);

    page=r.page;
    totalPages=r.totalPages;

    pageInfo.textContent=
      `Page ${page} of ${totalPages} • ${fmt(r.totalRows)} records`;

    prevPage.disabled=page<=1;
    nextPage.disabled=page>=totalPages;

    if(reload)
      await refreshFilters();

    await Promise.all([
      loadGroupSummary(),
      loadBudget()
    ]);

  }catch(e){

    console.error(e);
    alert('Dashboard error: '+e.message);

  }finally{

    loading.classList.remove('show');
  }
}

document.addEventListener(
'DOMContentLoaded',
async()=>{

try{

  buildFilterUI();

  const s=await rpc('raj_dashboard_schema');

  columns=s.columns||[];
  months=s.months||[];

  tableHead.innerHTML=
    columns.map(c=>`<th>${esc(c)}</th>`).join('');

  buildMonths();

  document.addEventListener('click',e=>{

    const b=e.target.closest('[data-open]');

    if(b){

      const box=
        document.getElementById(
          'multi_'+b.dataset.open
        );

      document.querySelectorAll('.multi.open')
        .forEach(x=>{
          if(x!==box)
            x.classList.remove('open')
        });

      box.classList.toggle('open');
      return
    }

    if(!e.target.closest('.multi'))
      document.querySelectorAll('.multi.open')
        .forEach(x=>x.classList.remove('open'));

  });

  filterDefs.forEach(([id])=>

    document.getElementById('search_'+id)
      .oninput=e=>{

        const t=e.target.value.toLowerCase();

        document.querySelectorAll(
          '#options_'+id+' .multi-option'
        ).forEach(o=>
          o.style.display=
            o.dataset.text.includes(t)
              ?'flex'
              :'none'
        );
      }
  );

  search_month.oninput=e=>{

    const t=e.target.value.toLowerCase();

    document.querySelectorAll(
      '#options_month .multi-option'
    ).forEach(o=>
      o.style.display=
        o.dataset.text.includes(t)
          ?'flex'
          :'none'
    );
  };

  await refreshFilters();
  await loadDashboard();

  productSaleStatus.onchange=()=>{
    page=1;
    loadDashboard(true)
  };

  budgetStatus.onchange=()=>{
    budgetPage=1;
    loadBudget()
  };

  budgetTarget.onchange=()=>{
    budgetPage=1;
    loadBudget()
  };

  budgetOD.oninput=()=>{

    clearTimeout(budgetTimer);

    budgetTimer=setTimeout(()=>{
      budgetPage=1;
      loadBudget()
    },350);
  };

  search.oninput=()=>{

    clearTimeout(timer);

    timer=setTimeout(()=>{
      page=1;
      loadDashboard(true)
    },350);
  };

  pageSize.onchange=()=>{
    page=1;
    loadDashboard()
  };

  prevPage.onclick=()=>{
    if(page>1){
      page--;
      loadDashboard()
    }
  };

  nextPage.onclick=()=>{
    if(page<totalPages){
      page++;
      loadDashboard()
    }
  };

  budgetPrev.onclick=()=>{

    if(budgetPage>1){
      budgetPage--;
      renderBudget()
    }
  };

  budgetNext.onclick=()=>{

    const tp=Math.max(
      1,
      Math.ceil(
        budgetRows.length/budgetPageSize
      )
    );

    if(budgetPage<tp){
      budgetPage++;
      renderBudget()
    }
  };

  clearFilters.onclick=async()=>{

    search.value='';

    selected.month=[];
    updateMonthLabel();

    document.querySelectorAll(
      '#options_month input'
    ).forEach(c=>c.checked=false);

    productSaleStatus.value='All';

    budgetStatus.value='all';
    budgetTarget.value='all';
    budgetOD.value='';

    filters.forEach(c=>{
      selected[c]=[];
      updateMultiLabel(c)
    });

    page=1;
    budgetPage=1;

    await refreshFilters();
    await loadDashboard();
  };

  document.querySelectorAll(
    '#viewTabs button'
  ).forEach(b=>

    b.onclick=async()=>{

      document.querySelectorAll(
        '#viewTabs button'
      ).forEach(x=>
        x.classList.remove('active')
      );

      b.classList.add('active');

      currentView=b.dataset.view;

      viewLabel.textContent=({
        Party:'Customer / Party',
        MainGrp:'Company / Main Group',
        ItemName:'Product / Item Name',
        SM:'SM',
        Division:'Division',
        Pincode:'Pincode'
      })[currentView]||currentView;

      await Promise.all([
        loadGroupSummary(),
        loadBudget()
      ]);
    }
  );

}catch(e){

  console.error(e);

  alert(
    'Startup error: '+
    e.message+
    '\nRun setup_supabase_dashboard.sql in Supabase first.'
  );
}

});
