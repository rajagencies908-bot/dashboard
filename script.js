const {createClient}=supabase;
const sb=createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);

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

const filters=filterDefs.map(x=>x[0]);
const selected={};

filters.forEach(f=>selected[f]=[]);
selected.month=[];

let columns=[];
let months=[];
let page=1;
let totalPages=1;
let currentView='Party';
let timer=null;

let budgetPage=1;
let budgetRows=[];
const budgetPageSize=25;

const fmt=n=>
  new Intl.NumberFormat('en-IN',{
    maximumFractionDigits:2
  }).format(Number(n||0));

const money=n=>
  '₹'+new Intl.NumberFormat('en-IN',{
    minimumFractionDigits:2,
    maximumFractionDigits:2
  }).format(Number(n||0));

const esc=v=>{
  const d=document.createElement('div');
  d.textContent=v??'';
  return d.innerHTML;
};

const monthNames={
  Jan:'January',
  Feb:'February',
  Mar:'March',
  Apr:'April',
  May:'May',
  Jun:'June',
  June:'June',
  Jul:'July',
  July:'July',
  Aug:'August',
  Sep:'September',
  Sept:'September',
  Oct:'October',
  Nov:'November',
  Dec:'December'
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
    filters
      .filter(c=>selected[c].length)
      .map(c=>[c,selected[c]])
  ),

  p_months:selected.month,

  p_sale_status:
    document.getElementById('productSaleStatus').value,

  p_search:
    document.getElementById('search').value.trim()
});


const budgetArgs=()=>({

  p_sms:
    selected.SM.length
      ?selected.SM
      :null,

  p_cities:
    selected.City.length
      ?selected.City
      :null,

  p_pincodes:
    selected.Pincode.length
      ?selected.Pincode
      :null,

  p_divisions:
    selected.Division.length
      ?selected.Division
      :null,

  p_parties:
    selected.Party.length
      ?selected.Party
      :null,

  p_ods:
    document.getElementById('budgetOD').value
      ?[document.getElementById('budgetOD').value]
      :null,

  p_target_mode:
    document.getElementById('budgetTarget').value,

  p_status:
    document.getElementById('budgetStatus').value,

  p_months:
    selected.month.length
      ?selected.month
      :null

});


async function rpc(name,args={}){

  const {data,error}=await sb.rpc(name,args);

  if(error){
    throw error;
  }

  return data;
}


function buildFilterUI(){

  document.getElementById('filterGrid').innerHTML=
    filterDefs.map(([id,label,all])=>`

      <div class="field">

        <label>${label}</label>

        <div class="multi" id="multi_${id}">

          <button
            type="button"
            class="multi-btn"
            data-open="${id}"
          >

            <span id="label_${id}">
              ${all}
            </span>

            <span>▾</span>

          </button>

          <div class="multi-menu">

            <input
              class="multi-search"
              id="search_${id}"
              placeholder="Search ${label}..."
            >

            <div
              class="multi-options"
              id="options_${id}"
            ></div>

          </div>

        </div>

        <div
          class="selected-chips"
          id="chips_${id}"
        ></div>

      </div>

    `).join('');
}


function buildMonths(){

  const box=document.getElementById('options_month');

  box.innerHTML=
    months.map(m=>`

      <label
        class="multi-option"
        data-text="${esc(
          (monthNames[m]||m).toLowerCase()
        )}"
      >

        <input
          type="checkbox"
          value="${esc(m)}"
        >

        <span>
          ${esc(monthNames[m]||m)}
        </span>

      </label>

    `).join('');

  box.querySelectorAll('input')
    .forEach(c=>{

      c.onchange=()=>{

        if(c.checked){

          if(!selected.month.includes(c.value)){
            selected.month.push(c.value);
          }

        }else{

          selected.month=
            selected.month.filter(
              x=>x!==c.value
            );
        }

        updateMonthLabel();

        page=1;
        budgetPage=1;

        loadDashboard(true);
      };

    });
}


function updateMultiLabel(column){

  const def=
    filterDefs.find(
      x=>x[0]===column
    );

  document.getElementById(
    'label_'+column
  ).textContent=

    selected[column].length
      ?`${selected[column].length} selected`
      :def[2];

  document.getElementById(
    'chips_'+column
  ).innerHTML=

    selected[column]
      .slice(0,4)
      .map(v=>
        `<span class="chip">
          ${esc(v)}
        </span>`
      )
      .join('')

    +

    (
      selected[column].length>4
        ?`<span class="chip">
            +${selected[column].length-4}
          </span>`
        :''
    );
}


function updateMonthLabel(){

  document.getElementById(
    'label_month'
  ).textContent=

    selected.month.length
      ?`${selected.month.length} selected`
      :'All Months / Total';

  document.getElementById(
    'chips_month'
  ).innerHTML=

    selected.month
      .map(v=>
        `<span class="chip">
          ${esc(monthNames[v]||v)}
        </span>`
      )
      .join('');
}


async function loadFilter(column){

  const data=
    await rpc(
      'raj_filter_values',
      {
        p_column:column,
        ...args()
      }
    );

  const box=
    document.getElementById(
      'options_'+column
    );

  box.innerHTML=
    (data||[])
      .map(v=>`

        <label
          class="multi-option"
          data-text="${esc(
            String(v).toLowerCase()
          )}"
        >

          <input
            type="checkbox"
            value="${esc(v)}"
            ${
              selected[column]
                .includes(String(v))
                ?'checked'
                :''
            }
          >

          <span>
            ${esc(v)}
          </span>

        </label>

      `).join('');

  box.querySelectorAll('input')
    .forEach(x=>{

      x.onchange=()=>{

        if(x.checked){

          if(
            !selected[column]
              .includes(x.value)
          ){
            selected[column]
              .push(x.value);
          }

        }else{

          selected[column]=
            selected[column]
              .filter(
                v=>v!==x.value
              );
        }

        updateMultiLabel(column);

        page=1;
        budgetPage=1;

        loadDashboard(true);
      };

    });
}


async function refreshFilters(){

  for(const column of filters){
    await loadFilter(column);
  }
}


/* ==============================
   OD DROPDOWN
============================== */

async function loadODOptions(){

  const data=
    await rpc(
      'raj_budget_od_values'
    );

  const box=
    document.getElementById(
      'budgetOD'
    );

  const current=box.value;

  box.innerHTML=
    '<option value="">All OD</option>'

    +

    (data||[])
      .map(row=>`

        <option value="${esc(row.OD)}">
          ${esc(row.OD)}
        </option>

      `)
      .join('');

  if(
    current &&
    [...box.options]
      .some(
        option=>option.value===current
      )
  ){
    box.value=current;
  }
}


/* ==============================
   MONTH SUMMARY
============================== */

function renderMonths(monthData){

  document.getElementById(
    'monthlyCards'
  ).innerHTML=

    months.map(month=>{

      const a=
        monthData?.[month]||{};

      return `

        <div class="month-card">

          <h4>
            ${esc(
              monthNames[month]||month
            )}
          </h4>

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

      `;

    }).join('');
}


/* ==============================
   DETAIL SALES TABLE
============================== */

function renderRows(rows){

  const body=
    document.getElementById(
      'tableBody'
    );

  if(!rows?.length){

    body.innerHTML=`

      <tr>

        <td
          class="empty"
          colspan="${columns.length}"
        >
          No matching data found.
        </td>

      </tr>

    `;

    return;
  }

  body.innerHTML=

    rows.map(row=>

      '<tr>'

      +

      columns.map(column=>

        `<td>${
          esc(
            /Qty|Taxable|Amt|Sale$/
              .test(column)
              ?fmt(row[column])
              :(row[column]??'')
          )
        }</td>`

      ).join('')

      +

      '</tr>'

    ).join('');
}


/* ==============================
   ANALYSIS SUMMARY
============================== */

async function loadGroupSummary(){

  const data=
    await rpc(
      'raj_group_summary',
      {
        p_view:currentView,
        ...args()
      }
    );

  const body=
    document.getElementById(
      'groupSummaryBody'
    );

  if(!data?.length){

    body.innerHTML=
      '<tr><td class="empty" colspan="7">No summary data found.</td></tr>';

    return;
  }

  body.innerHTML=

    data.map(x=>`

      <tr>

        <td>
          ${esc(x.label)}
        </td>

        <td>
          ${fmt(x.qty)}
        </td>

        <td>
          ${money(x.taxable)}
        </td>

        <td>
          ${money(x.sale)}
        </td>

        <td>
          ${fmt(x.productsSold)}
        </td>

        <td>
          ${fmt(x.customersBilled)}
        </td>

        <td>
          ${fmt(x.records)}
        </td>

      </tr>

    `).join('');
}


/* ==============================
   BUDGET MONTHS
============================== */

function budgetMonthsToShow(){

  const chosen=
    selected.month.length
      ?selected.month
      :months;

  const normalized=[];

  for(const month of chosen){

    const key=
      month==='Sept'
        ?'Sep'
        :month==='June'
          ?'Jun'
          :month==='July'
            ?'Jul'
            :month;

    if(
      budgetMonthMap[key] &&
      !normalized.includes(key)
    ){
      normalized.push(key);
    }
  }

  return normalized;
}


function diffClass(value){

  return Number(value||0)<0
    ?'budget-negative'
    :'budget-positive';
}


/* ==============================
   BUDGET TABLE
============================== */

function renderBudget(){

  const panel=
    document.getElementById(
      'budgetPanel'
    );

  /*
    Customer Budget Company Wise
    તથા Product Wiseમાં નથી બતાવવાનું.
  */

  if(
    currentView==='MainGrp' ||
    currentView==='ItemName'
  ){

    panel.classList.add(
      'budget-hidden'
    );

    return;

  }else{

    panel.classList.remove(
      'budget-hidden'
    );
  }


  const showMonths=
    budgetMonthsToShow();

  const multiSelected=
    selected.month.length>1;


  let head=
    '<th>SM</th>'+
    '<th>Customer / Party</th>'+
    '<th>Target</th>'+
    '<th>OD</th>';


  showMonths.forEach(month=>{

    const name=
      monthNames[month]||month;

    head+=
      `<th>${name} Sales</th>`+
      `<th>${name} Budget</th>`+
      `<th>${name} Diff</th>`;
  });


  if(
    multiSelected ||
    !selected.month.length
  ){

    head+=
      '<th>Total Sales</th>'+
      '<th>Total Budget</th>'+
      '<th>Total Diff</th>'+
      '<th>Achievement %</th>'+
      '<th>Status</th>';
  }


  document.getElementById(
    'budgetTableHead'
  ).innerHTML=head;


  document.getElementById(
    'budgetCount'
  ).textContent=
    fmt(budgetRows.length);


  const totalBudgetPages=
    Math.max(
      1,
      Math.ceil(
        budgetRows.length/
        budgetPageSize
      )
    );


  budgetPage=
    Math.min(
      budgetPage,
      totalBudgetPages
    );


  const rows=
    budgetRows.slice(

      (budgetPage-1)
      *budgetPageSize,

      budgetPage
      *budgetPageSize
    );


  const body=
    document.getElementById(
      'budgetTableBody'
    );


  if(!rows.length){

    body.innerHTML=`

      <tr>

        <td
          class="empty"
          colspan="${
            4+
            showMonths.length*3+
            5
          }"
        >
          No matching budget customers found.
        </td>

      </tr>

    `;

  }else{

    body.innerHTML=

      rows.map(row=>{

        let cells=

          `<td>
            ${esc(row.SalesMan||'')}
          </td>`

          +

          `<td>
            ${esc(row.Party||'')}
          </td>`

          +

          `<td>
            ${esc(row.Target||'')}
          </td>`

          +

          `<td>
            ${esc(row.Order||'')}
          </td>`;


        showMonths.forEach(month=>{

          const [
            budgetKey,
            salesKey,
            diffKey
          ]=
            budgetMonthMap[month];


          cells+=

            `<td>
              ${money(row[salesKey])}
            </td>`

            +

            `<td>
              ${money(row[budgetKey])}
            </td>`

            +

            `<td class="${
              diffClass(
                row[diffKey]
              )
            }">
              ${money(row[diffKey])}
            </td>`;
        });


        if(
          multiSelected ||
          !selected.month.length
        ){

          cells+=

            `<td>
              ${money(
                row.SelectedSales
              )}
            </td>`

            +

            `<td>
              ${money(
                row.SelectedBudget
              )}
            </td>`

            +

            `<td class="${
              diffClass(
                row.Difference
              )
            }">
              ${money(
                row.Difference
              )}
            </td>`

            +

            `<td>
              ${fmt(
                row.AchievementPct
              )}%
            </td>`

            +

            `<td>

              <span class="budget-status ${
                row.BudgetStatus==='ACHIEVED'
                  ?'ok'
                  :'bad'
              }">

                ${esc(
                  row.BudgetStatus||''
                )}

              </span>

            </td>`;
        }


        return `
          <tr>
            ${cells}
          </tr>
        `;

      }).join('');
  }


  document.getElementById(
    'budgetPageInfo'
  ).textContent=

    `Page ${budgetPage} of ${totalBudgetPages} • ${fmt(budgetRows.length)} customers`;


  document.getElementById(
    'budgetPrev'
  ).disabled=
    budgetPage<=1;


  document.getElementById(
    'budgetNext'
  ).disabled=
    budgetPage>=totalBudgetPages;


  document.getElementById(
    'budgetNote'
  ).textContent=

    selected.month.length

      ?`Showing ${
          selected.month
            .map(
              month=>
                monthNames[month]||month
            )
            .join(', ')
        } budget vs actual sales.`

      :'No month selected: showing all available months side-by-side.';
}


/* ==============================
   LOAD BUDGET DATA
============================== */

async function loadBudget(){

  if(
    currentView==='MainGrp' ||
    currentView==='ItemName'
  ){

    renderBudget();
    return;
  }


  const loading=
    document.getElementById(
      'budgetLoading'
    );

  loading.classList.add(
    'show'
  );


  try{

    budgetRows=

      await rpc(
        'raj_customer_budget_report',
        budgetArgs()
      )

      ||[];


    renderBudget();

  }catch(error){

    console.error(error);


    document.getElementById(
      'budgetTableBody'
    ).innerHTML=

      `<tr>

        <td class="empty">

          Budget error:
          ${esc(error.message)}

        </td>

      </tr>`;

  }finally{

    loading.classList.remove(
      'show'
    );
  }
}


/* ==============================
   MAIN DASHBOARD LOAD
============================== */

async function loadDashboard(
  reload=false
){

  const loading=
    document.getElementById(
      'loading'
    );

  loading.classList.add(
    'show'
  );


  try{

    const a=args();


    const [summaryResult,rowsResult]=
      await Promise.all([

        rpc(
          'raj_dashboard_summary',
          a
        ),

        rpc(
          'raj_dashboard_rows',
          {
            ...a,

            p_page:page,

            p_page_size:
              Number(
                document.getElementById(
                  'pageSize'
                ).value
              )
          }
        )

      ]);


    const summary=
      summaryResult.summary||{};


    document.getElementById(
      'totalQty'
    ).textContent=
      fmt(summary.TotalQty);


    document.getElementById(
      'totalTaxable'
    ).textContent=
      money(
        summary.TotalTaxable
      );


    document.getElementById(
      'totalSale'
    ).textContent=
      money(
        summary.TotalSale
      );


    document.getElementById(
      'productsSold'
    ).textContent=
      fmt(
        summary.ProductsSold
      );


    document.getElementById(
      'customersBilled'
    ).textContent=
      fmt(
        summary.CustomersBilled
      );


    document.getElementById(
      'recordCount'
    ).textContent=
      fmt(
        rowsResult.totalRows
      );


    renderMonths(
      summaryResult.monthly
    );


    renderRows(
      rowsResult.rows
    );


    page=
      rowsResult.page;

    totalPages=
      rowsResult.totalPages;


    document.getElementById(
      'pageInfo'
    ).textContent=

      `Page ${page} of ${totalPages} • ${fmt(rowsResult.totalRows)} records`;


    document.getElementById(
      'prevPage'
    ).disabled=
      page<=1;


    document.getElementById(
      'nextPage'
    ).disabled=
      page>=totalPages;


    if(reload){
      await refreshFilters();
    }


    await Promise.all([
      loadGroupSummary(),
      loadBudget()
    ]);


  }catch(error){

    console.error(error);

    alert(
      'Dashboard error: '+
      error.message
    );

  }finally{

    loading.classList.remove(
      'show'
    );
  }
}


/* ==============================
   PAGE START
============================== */

document.addEventListener(
  'DOMContentLoaded',
  async()=>{

    try{

      buildFilterUI();


      const schema=
        await rpc(
          'raj_dashboard_schema'
        );


      columns=
        schema.columns||[];

      months=
        schema.months||[];


      document.getElementById(
        'tableHead'
      ).innerHTML=

        columns
          .map(
            column=>
              `<th>
                ${esc(column)}
              </th>`
          )
          .join('');


      buildMonths();


      document.addEventListener(
        'click',
        event=>{

          const button=
            event.target.closest(
              '[data-open]'
            );


          if(button){

            const box=
              document.getElementById(
                'multi_'
                +button.dataset.open
              );


            document.querySelectorAll(
              '.multi.open'
            ).forEach(x=>{

              if(x!==box){
                x.classList.remove(
                  'open'
                );
              }

            });


            box.classList.toggle(
              'open'
            );

            return;
          }


          if(
            !event.target.closest(
              '.multi'
            )
          ){

            document.querySelectorAll(
              '.multi.open'
            ).forEach(
              x=>
                x.classList.remove(
                  'open'
                )
            );
          }

        }
      );


      filterDefs.forEach(
        ([id])=>{

          document.getElementById(
            'search_'+id
          ).oninput=event=>{

            const text=
              event.target.value
                .toLowerCase();


            document.querySelectorAll(
              '#options_'+
              id+
              ' .multi-option'
            ).forEach(option=>{

              option.style.display=
                option.dataset.text
                  .includes(text)
                  ?'flex'
                  :'none';

            });

          };

        }
      );


      document.getElementById(
        'search_month'
      ).oninput=event=>{

        const text=
          event.target.value
            .toLowerCase();


        document.querySelectorAll(
          '#options_month .multi-option'
        ).forEach(option=>{

          option.style.display=
            option.dataset.text
              .includes(text)
              ?'flex'
              :'none';

        });

      };


      await refreshFilters();

      /*
        OD dropdown budget_customer
        tableમાંથી automatically load થશે.
      */
      await loadODOptions();

      await loadDashboard();


      document.getElementById(
        'productSaleStatus'
      ).onchange=()=>{

        page=1;

        loadDashboard(true);
      };


      document.getElementById(
        'budgetStatus'
      ).onchange=()=>{

        budgetPage=1;

        loadBudget();
      };


      document.getElementById(
        'budgetTarget'
      ).onchange=()=>{

        budgetPage=1;

        loadBudget();
      };


      /*
        OD હવે textbox નથી.
        Dropdown છે.
      */

      document.getElementById(
        'budgetOD'
      ).onchange=()=>{

        budgetPage=1;

        loadBudget();
      };


      document.getElementById(
        'search'
      ).oninput=()=>{

        clearTimeout(timer);

        timer=setTimeout(
          ()=>{

            page=1;

            loadDashboard(true);

          },
          350
        );

      };


      document.getElementById(
        'pageSize'
      ).onchange=()=>{

        page=1;

        loadDashboard();
      };


      document.getElementById(
        'prevPage'
      ).onclick=()=>{

        if(page>1){

          page--;

          loadDashboard();
        }
      };


      document.getElementById(
        'nextPage'
      ).onclick=()=>{

        if(page<totalPages){

          page++;

          loadDashboard();
        }
      };


      document.getElementById(
        'budgetPrev'
      ).onclick=()=>{

        if(budgetPage>1){

          budgetPage--;

          renderBudget();
        }
      };


      document.getElementById(
        'budgetNext'
      ).onclick=()=>{

        const pages=
          Math.max(
            1,
            Math.ceil(
              budgetRows.length/
              budgetPageSize
            )
          );


        if(budgetPage<pages){

          budgetPage++;

          renderBudget();
        }
      };


      document.getElementById(
        'clearFilters'
      ).onclick=async()=>{

        document.getElementById(
          'search'
        ).value='';


        selected.month=[];

        updateMonthLabel();


        document.querySelectorAll(
          '#options_month input'
        ).forEach(
          checkbox=>
            checkbox.checked=false
        );


        document.getElementById(
          'productSaleStatus'
        ).value='All';


        document.getElementById(
          'budgetStatus'
        ).value='all';


        document.getElementById(
          'budgetTarget'
        ).value='all';


        document.getElementById(
          'budgetOD'
        ).value='';


        filters.forEach(
          column=>{

            selected[column]=[];

            updateMultiLabel(
              column
            );
          }
        );


        page=1;
        budgetPage=1;


        await refreshFilters();

        await loadDashboard();
      };


      document.querySelectorAll(
        '#viewTabs button'
      ).forEach(button=>{

        button.onclick=async()=>{

          document.querySelectorAll(
            '#viewTabs button'
          ).forEach(
            x=>
              x.classList.remove(
                'active'
              )
          );


          button.classList.add(
            'active'
          );


          currentView=
            button.dataset.view;


          document.getElementById(
            'viewLabel'
          ).textContent=

            ({
              Party:
                'Customer / Party',

              MainGrp:
                'Company / Main Group',

              ItemName:
                'Product / Item Name',

              SM:
                'SM',

              Division:
                'Division',

              Pincode:
                'Pincode'

            })[currentView]

            ||currentView;


          await Promise.all([
            loadGroupSummary(),
            loadBudget()
          ]);

        };

      });


    }catch(error){

      console.error(error);

      alert(
        'Startup error: '+
        error.message+
        '\nRun required Supabase SQL functions first.'
      );
    }

  }
);
