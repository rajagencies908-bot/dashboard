const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);


/* ==============================
   FILTER DEFINITIONS
============================== */

const filterDefs = [
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

const filters = filterDefs.map(x => x[0]);

const selected = {};
const searchState = {};

filters.forEach(f => {
  selected[f] = [];
  searchState[f] = '';
});

selected.month = [];
selected.budgetOD = [];

searchState.month = '';
searchState.budgetOD = '';

let columns = [];
let months = [];

let page = 1;
let totalPages = 1;

let currentView = 'Party';

let timer = null;

let budgetPage = 1;
let budgetRows = [];

let odParties = [];

let budgetMonthStats = {};

const budgetPageSize = 25;


/* ==============================
   MONTH NAMES
============================== */

const monthNames = {
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


/* ==============================
   BUDGET MONTH MAP
============================== */

const budgetMonthMap = {
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


/* ==============================
   HELPERS
============================== */

const el = id =>
  document.getElementById(id);

const fmt = n =>
  new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:2
    }
  ).format(
    Number(n || 0)
  );

const money = n =>
  '₹' +
  new Intl.NumberFormat(
    'en-IN',
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2
    }
  ).format(
    Number(n || 0)
  );

const esc = v => {

  const d =
    document.createElement('div');

  d.textContent =
    v ?? '';

  return d.innerHTML;
};


/* ==============================
   RPC
============================== */

async function rpc(
  name,
  params = {}
){

  const {
    data,
    error
  } = await sb.rpc(
    name,
    params
  );

  if(error){
    throw error;
  }

  return data;
}


/* ==============================
   MONTH HELPERS
============================== */

function normalizeMonth(m){

  if(m === 'Jun'){
    return 'June';
  }

  if(m === 'Jul'){
    return 'July';
  }

  if(m === 'Sep'){
    return 'Sept';
  }

  return m;
}


function monthAmountColumn(month){

  const candidates = [
    `${month}Amt`,
    `${normalizeMonth(month)}Amt`,
    month === 'June' ? 'JuneAmt' : '',
    month === 'July' ? 'JulyAmt' : '',
    month === 'Sept' ? 'SeptAmt' : ''
  ].filter(Boolean);

  return (
    candidates.find(
      c => columns.includes(c)
    )
    ||
    null
  );
}


function activeAverageMonths(){

  return selected.month.length
    ? selected.month
    : months;
}


function rowAverageSale(row){

  const activeMonths =
    activeAverageMonths();

  if(!activeMonths.length){
    return 0;
  }

  let total = 0;
  let count = 0;

  for(const month of activeMonths){

    const column =
      monthAmountColumn(month);

    if(column){

      total +=
        Number(
          row[column] || 0
        );

      count++;
    }
  }

  return count
    ? total / count
    : 0;
}


/* ==============================
   EFFECTIVE FILTER OBJECT
============================== */

function effectiveFilterObject(){

  const obj = {};

  for(const column of filters){

    if(selected[column].length){

      obj[column] =
        [...selected[column]];
    }
  }

  /*
    OD:
    budget_customer Order
    -> Party list
    -> products Party
  */

  if(selected.budgetOD.length){

    let parties =
      odParties.map(String);

    if(selected.Party.length){

      const allowed =
        new Set(parties);

      parties =
        selected.Party.filter(
          p =>
            allowed.has(
              String(p)
            )
        );
    }

    obj.Party =
      parties.length
        ? parties
        : ['__RAJ_NO_MATCHING_PARTY__'];
  }

  return obj;
}


/* ==============================
   FILTER OPTIONS

   Current filter's own value
   remove કરીએ છીએ જેથી
   same searchમાં multiple select
   stable રહે.
============================== */

function filterObjectForOptions(column){

  const obj =
    effectiveFilterObject();

  if(column !== 'Party'){

    delete obj[column];

  }else if(selected.budgetOD.length){

    obj.Party =
      odParties.length
        ? [...odParties]
        : ['__RAJ_NO_MATCHING_PARTY__'];

  }else{

    delete obj.Party;
  }

  return obj;
}


/* ==============================
   MAIN ARGS
============================== */

const args = () => ({

  p_filters:
    effectiveFilterObject(),

  p_months:
    selected.month,

  p_sale_status:
    el('productSaleStatus')
      ? el('productSaleStatus').value
      : 'All',

  p_search:
    el('search')
      ? el('search').value.trim()
      : ''
});


/* ==============================
   FILTER ARGS
============================== */

const filterArgs = column => ({

  p_filters:
    filterObjectForOptions(column),

  p_months:
    selected.month,

  p_sale_status:
    el('productSaleStatus')
      ? el('productSaleStatus').value
      : 'All',

  p_search:
    el('search')
      ? el('search').value.trim()
      : ''
});


/* ==============================
   BUDGET ARGS
============================== */

const budgetArgs = () => ({

  p_sms:
    selected.SM.length
      ? selected.SM
      : null,

  p_cities:
    selected.City.length
      ? selected.City
      : null,

  p_pincodes:
    selected.Pincode.length
      ? selected.Pincode
      : null,

  p_divisions:
    selected.Division.length
      ? selected.Division
      : null,

  p_parties:
    selected.Party.length
      ? selected.Party
      : null,

  p_ods:
    selected.budgetOD.length
      ? selected.budgetOD
      : null,

  p_target_mode:
    el('budgetTarget')
      ? el('budgetTarget').value
      : 'all',

  p_status:
    el('budgetStatus')
      ? el('budgetStatus').value
      : 'all',

  p_months:
    selected.month.length
      ? selected.month
      : null
});


/* ==============================
   BUDGET MONTH SUMMARY ARGS
============================== */

const budgetSummaryArgs = () => ({

  p_sms:
    selected.SM.length
      ? selected.SM
      : null,

  p_parties:
    selected.Party.length
      ? selected.Party
      : null,

  p_ods:
    selected.budgetOD.length
      ? selected.budgetOD
      : null,

  p_target_mode:
    el('budgetTarget')
      ? el('budgetTarget').value
      : 'all'
});


/* ==============================
   SELECT ALL BUTTONS
============================== */

function bulkButtons(id){

  return `
    <div style="
      display:flex;
      gap:8px;
      padding:8px 6px 10px;
      border-bottom:1px solid #e5e7eb;
      position:sticky;
      top:0;
      background:#fff;
      z-index:5;
    ">

      <button
        type="button"
        data-select-all="${id}"
        style="
          flex:1;
          padding:7px 9px;
          border:1px solid #cbd5e1;
          border-radius:8px;
          background:#f8fafc;
          cursor:pointer;
          font-weight:600;
        "
      >
        Select All
      </button>

      <button
        type="button"
        data-unselect-all="${id}"
        style="
          flex:1;
          padding:7px 9px;
          border:1px solid #cbd5e1;
          border-radius:8px;
          background:#f8fafc;
          cursor:pointer;
          font-weight:600;
        "
      >
        Unselect All
      </button>

    </div>
  `;
}


/* ==============================
   BUILD FILTER UI
============================== */

function buildFilterUI(){

  const grid =
    el('filterGrid');

  if(!grid){
    return;
  }

  grid.innerHTML =
    filterDefs
      .map(
        ([id,label,all]) => `

          <div class="field">

            <label>
              ${label}
            </label>

            <div
              class="multi"
              id="multi_${id}"
            >

              <button
                type="button"
                class="multi-btn"
                data-open="${id}"
              >

                <span id="label_${id}">
                  ${all}
                </span>

                <span>
                  ▾
                </span>

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

        `
      )
      .join('');
}


/* ==============================
   LABELS
============================== */

function updateMultiLabel(column){

  const def =
    filterDefs.find(
      x => x[0] === column
    );

  if(el('label_' + column)){

    el(
      'label_' + column
    ).textContent =
      selected[column].length
        ? `${selected[column].length} selected`
        : def[2];
  }

  if(el('chips_' + column)){

    el(
      'chips_' + column
    ).innerHTML =

      selected[column]
        .slice(0,4)
        .map(
          v =>
            `<span class="chip">${esc(v)}</span>`
        )
        .join('')

      +

      (
        selected[column].length > 4
          ? `<span class="chip">+${selected[column].length - 4}</span>`
          : ''
      );
  }
}


function updateMonthLabel(){

  if(el('label_month')){

    el(
      'label_month'
    ).textContent =
      selected.month.length
        ? `${selected.month.length} selected`
        : 'All Months / Total';
  }

  if(el('chips_month')){

    el(
      'chips_month'
    ).innerHTML =
      selected.month
        .map(
          v =>
            `<span class="chip">${esc(monthNames[v] || v)}</span>`
        )
        .join('');
  }
}


function updateODLabel(){

  if(el('label_budgetOD')){

    el(
      'label_budgetOD'
    ).textContent =
      selected.budgetOD.length
        ? `${selected.budgetOD.length} selected`
        : 'All OD';
  }

  if(el('chips_budgetOD')){

    el(
      'chips_budgetOD'
    ).innerHTML =

      selected.budgetOD
        .slice(0,4)
        .map(
          v =>
            `<span class="chip">${esc(v)}</span>`
        )
        .join('')

      +

      (
        selected.budgetOD.length > 4
          ? `<span class="chip">+${selected.budgetOD.length - 4}</span>`
          : ''
      );
  }
}


/* ==============================
   MULTI SEARCH
============================== */

function valuesFromOptions(
  id,
  visibleOnly = false
){

  return [
    ...document.querySelectorAll(
      `#options_${id} input[type="checkbox"]`
    )
  ]
    .filter(
      x =>
        !visibleOnly
        ||
        x.closest('.multi-option')
          ?.style
          .display !== 'none'
    )
    .map(
      x => x.value
    );
}


function applySearchFilter(id){

  const search =
    el('search_' + id);

  if(!search){
    return;
  }

  const text =
    String(
      searchState[id]
      ??
      search.value
      ??
      ''
    )
      .toLowerCase()
      .trim();

  search.value =
    searchState[id]
    ??
    search.value
    ??
    '';

  document
    .querySelectorAll(
      `#options_${id} .multi-option`
    )
    .forEach(
      option => {

        const optionText =
          String(
            option.dataset.text || ''
          )
            .toLowerCase();

        option.style.display =
          optionText.includes(text)
            ? 'flex'
            : 'none';
      }
    );
}


function restoreOpenFilter(id){

  const search =
    el('search_' + id);

  const multi =
    el('multi_' + id);

  if(search){

    search.value =
      searchState[id] || '';
  }

  applySearchFilter(id);

  if(multi){

    multi.classList.add('open');
  }

  if(search){

    requestAnimationFrame(
      () => {

        search.focus();

        const len =
          search.value.length;

        try{

          search.setSelectionRange(
            len,
            len
          );

        }catch(_){}
      }
    );
  }
}


function wireSearchBox(id){

  const search =
    el('search_' + id);

  if(!search){
    return;
  }

  search.value =
    searchState[id] || '';

  search.oninput =
    () => {

      searchState[id] =
        search.value;

      applySearchFilter(id);
    };
}


/* ==============================
   BULK SELECTION
============================== */

async function applyBulkSelection(
  id,
  selectAll
){

  const visibleOnly =
    Boolean(
      (
        searchState[id] || ''
      ).trim()
    );


  if(id === 'month'){

    selected.month =
      selectAll
        ? valuesFromOptions(
            'month',
            visibleOnly
          )
        : [];

    document
      .querySelectorAll(
        '#options_month input[type="checkbox"]'
      )
      .forEach(
        x => {

          if(
            !visibleOnly
            ||
            x.closest('.multi-option')
              ?.style
              .display !== 'none'
          ){

            x.checked =
              selectAll;
          }
        }
      );

    updateMonthLabel();

    page = 1;
    budgetPage = 1;

    await loadDashboard(true);

    restoreOpenFilter('month');

    return;
  }


  if(id === 'budgetOD'){

    selected.budgetOD =
      selectAll
        ? valuesFromOptions(
            'budgetOD',
            visibleOnly
          )
        : [];

    document
      .querySelectorAll(
        '#options_budgetOD input[type="checkbox"]'
      )
      .forEach(
        x => {

          if(
            !visibleOnly
            ||
            x.closest('.multi-option')
              ?.style
              .display !== 'none'
          ){

            x.checked =
              selectAll;
          }
        }
      );

    updateODLabel();

    await refreshODPartyScope();

    page = 1;
    budgetPage = 1;

    await loadDashboard(true);

    restoreOpenFilter('budgetOD');

    return;
  }


  if(!filters.includes(id)){
    return;
  }

  selected[id] =
    selectAll
      ? valuesFromOptions(
          id,
          visibleOnly
        )
      : [];

  document
    .querySelectorAll(
      `#options_${id} input[type="checkbox"]`
    )
    .forEach(
      x => {

        if(
          !visibleOnly
          ||
          x.closest('.multi-option')
            ?.style
            .display !== 'none'
        ){

          x.checked =
            selectAll;
        }
      }
    );

  updateMultiLabel(id);

  page = 1;
  budgetPage = 1;

  await loadDashboard(true);

  restoreOpenFilter(id);
}


/* ==============================
   MONTH FILTER
============================== */

function buildMonths(){

  const box =
    el('options_month');

  if(!box){
    return;
  }

  box.innerHTML =

    bulkButtons('month')

    +

    months
      .map(
        month => `

          <label
            class="multi-option"
            data-text="${esc(
              (
                monthNames[month] || month
              ).toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(month)}"
              ${
                selected.month.includes(
                  String(month)
                )
                  ? 'checked'
                  : ''
              }
            >

            <span>
              ${esc(
                monthNames[month] || month
              )}
            </span>

          </label>

        `
      )
      .join('');

  box
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          async () => {

            if(checkbox.checked){

              if(
                !selected.month.includes(
                  checkbox.value
                )
              ){

                selected.month.push(
                  checkbox.value
                );
              }

            }else{

              selected.month =
                selected.month.filter(
                  month =>
                    month !== checkbox.value
                );
            }

            updateMonthLabel();

            page = 1;
            budgetPage = 1;

            await loadDashboard(true);

            restoreOpenFilter('month');
          };
      }
    );

  applySearchFilter('month');
}


/* ==============================
   LOAD FILTER VALUES
============================== */

async function loadFilter(column){

  const data =
    await rpc(
      'raj_filter_values',
      {
        p_column:column,
        ...filterArgs(column)
      }
    );

  const box =
    el('options_' + column);

  if(!box){
    return;
  }

  const rawValues =
    (data || [])
      .map(
        value =>
          typeof value === 'object'
          &&
          value !== null
            ? (
                value.value
                ??
                value.Value
                ??
                Object.values(value)[0]
              )
            : value
      );

  const values =
    [
      ...new Set(
        [
          ...rawValues.map(
            value =>
              String(value ?? '')
          ),
          ...selected[column]
        ]
      )
    ]
      .filter(Boolean);

  box.innerHTML =

    bulkButtons(column)

    +

    values
      .map(
        value => `

          <label
            class="multi-option"
            data-text="${esc(
              String(value).toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(value)}"
              ${
                selected[column].includes(
                  String(value)
                )
                  ? 'checked'
                  : ''
              }
            >

            <span>
              ${esc(value)}
            </span>

          </label>

        `
      )
      .join('');

  box
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          async () => {

            if(checkbox.checked){

              if(
                !selected[column].includes(
                  checkbox.value
                )
              ){

                selected[column].push(
                  checkbox.value
                );
              }

            }else{

              selected[column] =
                selected[column].filter(
                  value =>
                    value !== checkbox.value
                );
            }

            updateMultiLabel(column);

            page = 1;
            budgetPage = 1;

            await loadDashboard(true);

            restoreOpenFilter(column);
          };
      }
    );

  applySearchFilter(column);
}


async function refreshFilters(){

  for(const column of filters){

    await loadFilter(column);
  }
}


/* ==============================
   OD
============================== */

async function loadODOptions(){

  const box =
    el('options_budgetOD');

  if(!box){
    return;
  }

  const data =
    await rpc(
      'raj_budget_od_values'
    );

  const values =
    (data || [])
      .map(
        row =>
          String(
            row.OD
            ??
            row.od
            ??
            ''
          )
      )
      .filter(Boolean);

  box.innerHTML =

    bulkButtons('budgetOD')

    +

    values
      .map(
        value => `

          <label
            class="multi-option"
            data-text="${esc(
              value.toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(value)}"
              ${
                selected.budgetOD.includes(
                  value
                )
                  ? 'checked'
                  : ''
              }
            >

            <span>
              ${esc(value)}
            </span>

          </label>

        `
      )
      .join('');

  box
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(
      checkbox => {

        checkbox.onchange =
          async () => {

            if(checkbox.checked){

              if(
                !selected.budgetOD.includes(
                  checkbox.value
                )
              ){

                selected.budgetOD.push(
                  checkbox.value
                );
              }

            }else{

              selected.budgetOD =
                selected.budgetOD.filter(
                  value =>
                    value !== checkbox.value
                );
            }

            updateODLabel();

            await refreshODPartyScope();

            page = 1;
            budgetPage = 1;

            await loadDashboard(true);

            restoreOpenFilter(
              'budgetOD'
            );
          };
      }
    );

  applySearchFilter(
    'budgetOD'
  );
}


async function refreshODPartyScope(){

  if(!selected.budgetOD.length){

    odParties = [];

    return;
  }

  const data =
    await rpc(
      'raj_budget_od_parties',
      {
        p_ods:selected.budgetOD
      }
    );

  odParties =
    (data || [])
      .map(
        row =>
          String(
            row.Party
            ??
            row.party
            ??
            ''
          ).trim()
      )
      .filter(Boolean);
}


/* ==============================
   BUDGET MONTH SUMMARY
============================== */

async function loadBudgetMonthSummary(){

  try{

    const data =
      await rpc(
        'raj_budget_month_summary',
        budgetSummaryArgs()
      );

    budgetMonthStats = {};

    for(const row of (data || [])){

      const month =
        row.Month
        ??
        row.month;

      if(!month){
        continue;
      }

      budgetMonthStats[month] = {

        BudgetCustomers:
          Number(
            row.BudgetCustomers
            ??
            row.budgetcustomers
            ??
            0
          ),

        SalesCustomers:
          Number(
            row.SalesCustomers
            ??
            row.salescustomers
            ??
            0
          ),

        ZeroSalesCustomers:
          Number(
            row.ZeroSalesCustomers
            ??
            row.zerosalescustomers
            ??
            0
          )
      };
    }

  }catch(error){

    console.error(
      'Budget month summary error:',
      error
    );

    budgetMonthStats = {};
  }
}


/* ==============================
   IMPORTANT ERROR FIX
============================== */

function budgetStatsForMonth(month){

  return (
    budgetMonthStats[month]
    ||
    budgetMonthStats[
      normalizeMonth(month)
    ]
    ||
    budgetMonthStats[
      month === 'Jun'
        ? 'June'
        : month === 'Jul'
          ? 'July'
          : month === 'Sep'
            ? 'Sept'
            : month
    ]
    ||
    {
      BudgetCustomers:0,
      SalesCustomers:0,
      ZeroSalesCustomers:0
    }
  );
}


/* ==============================
   MONTH SUMMARY CARDS
============================== */

function renderMonths(monthData){

  const container =
    el('monthlyCards');

  if(!container){
    return;
  }

  const averageMonths =
    activeAverageMonths();

  const averageTotal =
    averageMonths.reduce(
      (total,month) =>
        total
        +
        Number(
          monthData?.[month]?.Sale
          || 0
        ),
      0
    );

  const averageSale =
    averageMonths.length
      ? averageTotal
        /
        averageMonths.length
      : 0;

  const averageCard = `

    <div class="month-card avg-card">

      <h4>
        Average Monthly Sale
      </h4>

      <div class="metric">

        <span>
          Months Used
        </span>

        <b>
          ${fmt(
            averageMonths.length
          )}
        </b>

      </div>

      <div class="metric">

        <span>
          Avg Sales
        </span>

        <b>
          ${money(
            averageSale
          )}
        </b>

      </div>

    </div>
  `;

  const monthCards =
    months
      .map(
        month => {

          const sales =
            monthData?.[month]
            ||
            {};

          const budget =
            budgetStatsForMonth(
              month
            );

          return `

            <div class="month-card">

              <h4>
                ${esc(
                  monthNames[month]
                  ||
                  month
                )}
              </h4>

              <div class="metric">
                <span>Qty</span>
                <b>${fmt(sales.Qty)}</b>
              </div>

              <div class="metric">
                <span>Taxable</span>
                <b>${money(sales.Taxable)}</b>
              </div>

              <div class="metric">
                <span>Sale</span>
                <b>${money(sales.Sale)}</b>
              </div>

              <div class="metric">
                <span>Products Sold</span>
                <b>${fmt(sales.ProductsSold)}</b>
              </div>

              <div class="metric">
                <span>Customers Billed</span>
                <b>${fmt(sales.CustomersBilled)}</b>
              </div>

              <div class="metric">
                <span>Budget Customers</span>
                <b>${fmt(
                  budget.BudgetCustomers || 0
                )}</b>
              </div>

              <div class="metric">
                <span>Sales Customers</span>
                <b>${fmt(
                  budget.SalesCustomers || 0
                )}</b>
              </div>

              <div class="metric">
                <span>Zero Sales Customers</span>
                <b>${fmt(
                  budget.ZeroSalesCustomers || 0
                )}</b>
              </div>

            </div>
          `;
        }
      )
      .join('');

  container.innerHTML =
    averageCard
    +
    monthCards;
}


/* ==============================
   DETAIL TABLE
============================== */

function renderRows(rows){

  const body =
    el('tableBody');

  if(!body){
    return;
  }

  if(!rows?.length){

    body.innerHTML = `
      <tr>
        <td
          class="empty"
          colspan="${Math.max(
            columns.length + 1,
            1
          )}"
        >
          No matching data found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    rows
      .map(
        row => {

          const normalCells =
            columns
              .map(
                column => {

                  const value =
                    row[column]
                    ??
                    '';

                  return `
                    <td>
                      ${
                        esc(
                          /Qty|Taxable|Amt|Sale$/
                            .test(column)
                            ? fmt(value)
                            : value
                        )
                      }
                    </td>
                  `;
                }
              )
              .join('');

          const averageCell = `
            <td>
              ${money(
                rowAverageSale(row)
              )}
            </td>
          `;

          return `
            <tr>
              ${normalCells}
              ${averageCell}
            </tr>
          `;
        }
      )
      .join('');
}


/* ==============================
   ANALYSIS VIEW
============================== */

async function loadGroupSummary(){

  const body =
    el('groupSummaryBody');

  if(!body){
    return;
  }

  const headRow =
    body
      .closest('table')
      ?.querySelector(
        'thead tr'
      );

  if(!headRow){
    return;
  }

  const analysisMonths =
    activeAverageMonths();

  try{

    const results =
      await Promise.all(
        [
          rpc(
            'raj_group_summary',
            {
              p_view:currentView,
              ...args()
            }
          ),

          ...analysisMonths.map(
            month =>
              rpc(
                'raj_group_summary',
                {
                  p_view:currentView,
                  ...args(),
                  p_months:[month]
                }
              )
          )
        ]
      );

    const totalData =
      results[0] || [];

    const monthlyData =
      results.slice(1);

    const viewName =
      ({
        Party:'Customer / Party',
        MainGrp:'Company / Main Group',
        ItemName:'Product / Item Name',
        SM:'SM',
        Division:'Division',
        Pincode:'Pincode'
      })[currentView]
      ||
      currentView;

    let header = `
      <th id="viewLabel">
        ${esc(viewName)}
      </th>
    `;

    analysisMonths.forEach(
      month => {

        header += `
          <th>
            ${esc(
              monthNames[month]
              ||
              month
            )} Sale
          </th>
        `;
      }
    );

    header +=
      '<th>Avg Sale</th>'
      +
      '<th>Qty</th>'
      +
      '<th>Taxable</th>'
      +
      '<th>Total Sale</th>'
      +
      '<th>Products Sold</th>'
      +
      '<th>Customers Billed</th>'
      +
      '<th>Records</th>';

    headRow.innerHTML =
      header;

    if(!totalData.length){

      body.innerHTML = `
        <tr>
          <td
            class="empty"
            colspan="${
              8
              +
              analysisMonths.length
            }"
          >
            No summary data found.
          </td>
        </tr>
      `;

      return;
    }

    const monthMaps =
      monthlyData.map(
        rows => {

          const map =
            new Map();

          (rows || [])
            .forEach(
              row =>
                map.set(
                  String(row.label),
                  Number(
                    row.sale || 0
                  )
                )
            );

          return map;
        }
      );

    body.innerHTML =
      totalData
        .map(
          row => {

            const monthSales =
              analysisMonths.map(
                (month,index) =>
                  monthMaps[index]
                    ?.get(
                      String(row.label)
                    )
                  ||
                  0
              );

            const averageSale =
              monthSales.length
                ? monthSales.reduce(
                    (total,sale) =>
                      total + sale,
                    0
                  )
                  /
                  monthSales.length
                : 0;

            const monthCells =
              monthSales
                .map(
                  sale =>
                    `<td>${money(sale)}</td>`
                )
                .join('');

            return `
              <tr>

                <td>
                  ${esc(row.label)}
                </td>

                ${monthCells}

                <td>
                  ${money(averageSale)}
                </td>

                <td>
                  ${fmt(row.qty)}
                </td>

                <td>
                  ${money(row.taxable)}
                </td>

                <td>
                  ${money(row.sale)}
                </td>

                <td>
                  ${fmt(row.productsSold)}
                </td>

                <td>
                  ${fmt(row.customersBilled)}
                </td>

                <td>
                  ${fmt(row.records)}
                </td>

              </tr>
            `;
          }
        )
        .join('');

  }catch(error){

    console.error(
      'Analysis View Error:',
      error
    );

    body.innerHTML = `
      <tr>
        <td class="empty">
          Analysis error:
          ${esc(error.message)}
        </td>
      </tr>
    `;
  }
}


/* ==============================
   SALES COMPARISON

   SAME TOP MONTH FILTER
============================== */

async function loadComparison(){

  const setText =
    (id,value) => {

      const node =
        el(id);

      if(node){
        node.textContent =
          value;
      }
    };

  const statusEl =
    el('compareStatus');


  if(selected.month.length < 2){

    setText(
      'compareMonthsText',
      'Select at least 2 months'
    );

    setText(
      'compareActualMonth',
      '-'
    );

    setText(
      'compareAvgSale',
      money(0)
    );

    setText(
      'compareActualSale',
      money(0)
    );

    setText(
      'compareDifference',
      money(0)
    );

    setText(
      'comparePercent',
      '0%'
    );

    if(statusEl){

      statusEl.textContent =
        'Select at least 2 months';

      statusEl.className =
        'compare-status compare-neutral';
    }

    return;
  }


  /*
    Schema order મુજબ selected months sort.
    Last selected chronological month = Actual.
  */

  const orderedSelected =
    months.filter(
      month =>
        selected.month.includes(month)
    );

  if(orderedSelected.length < 2){
    return;
  }

  const actualMonth =
    orderedSelected[
      orderedSelected.length - 1
    ];

  const compareMonths =
    orderedSelected.slice(
      0,
      -1
    );

  setText(
    'compareMonthsText',
    compareMonths
      .map(
        month =>
          monthNames[month]
          ||
          month
      )
      .join(' + ')
  );

  setText(
    'compareActualMonth',
    monthNames[actualMonth]
    ||
    actualMonth
  );

  try{

    const baseArgs =
      args();

    const compareResults =
      await Promise.all(
        compareMonths.map(
          month =>
            rpc(
              'raj_dashboard_summary',
              {
                ...baseArgs,
                p_months:[month]
              }
            )
        )
      );

    const actualResult =
      await rpc(
        'raj_dashboard_summary',
        {
          ...baseArgs,
          p_months:[actualMonth]
        }
      );

    const compareSales =
      compareResults.map(
        result =>
          Number(
            result?.summary?.TotalSale
            ||
            0
          )
      );

    const compareTotal =
      compareSales.reduce(
        (total,sale) =>
          total + sale,
        0
      );

    const compareAvg =
      compareSales.length
        ? compareTotal
          /
          compareSales.length
        : 0;

    const actualSale =
      Number(
        actualResult
          ?.summary
          ?.TotalSale
        ||
        0
      );

    const diff =
      actualSale
      -
      compareAvg;

    const pct =
      compareAvg !== 0
        ? (
            diff
            /
            compareAvg
          )
          *
          100
        : 0;

    setText(
      'compareAvgSale',
      money(compareAvg)
    );

    setText(
      'compareActualSale',
      money(actualSale)
    );

    setText(
      'compareDifference',
      (
        diff > 0
          ? '+'
          : ''
      )
      +
      money(diff)
    );

    setText(
      'comparePercent',
      (
        pct > 0
          ? '+'
          : ''
      )
      +
      fmt(pct)
      +
      '%'
    );

    if(statusEl){

      if(diff > 0){

        statusEl.textContent =
          'Above Avg';

        statusEl.className =
          'compare-status compare-positive';

      }else if(diff < 0){

        statusEl.textContent =
          'Below Avg';

        statusEl.className =
          'compare-status compare-negative';

      }else{

        statusEl.textContent =
          'Equal to Avg';

        statusEl.className =
          'compare-status compare-neutral';
      }
    }

  }catch(error){

    console.error(
      'Comparison error:',
      error
    );

    if(statusEl){

      statusEl.textContent =
        'Comparison error';

      statusEl.className =
        'compare-status compare-negative';
    }
  }
}


/* ==============================
   BUDGET MONTH DISPLAY
============================== */

function budgetMonthsToShow(){

  const chosen =
    selected.month.length
      ? selected.month
      : months;

  const normalized = [];

  for(const month of chosen){

    const key =
      month === 'Sept'
        ? 'Sep'
        : month === 'June'
          ? 'Jun'
          : month === 'July'
            ? 'Jul'
            : month;

    if(
      budgetMonthMap[key]
      &&
      !normalized.includes(key)
    ){

      normalized.push(key);
    }
  }

  return normalized;
}


function diffClass(value){

  return Number(value || 0) < 0
    ? 'budget-negative'
    : 'budget-positive';
}


/* ==============================
   RENDER BUDGET
============================== */

function renderBudget(){

  const panel =
    el('budgetPanel');

  if(!panel){
    return;
  }

  if(
    currentView === 'MainGrp'
    ||
    currentView === 'ItemName'
  ){

    panel.classList.add(
      'budget-hidden'
    );

    return;
  }

  panel.classList.remove(
    'budget-hidden'
  );

  const showMonths =
    budgetMonthsToShow();

  const multiSelected =
    selected.month.length > 1;

  let head =
    '<th>SM</th>'
    +
    '<th>Customer / Party</th>'
    +
    '<th>Target</th>'
    +
    '<th>OD</th>';

  showMonths.forEach(
    month => {

      const name =
        monthNames[month]
        ||
        month;

      head +=
        `<th>${name} Sales</th>`
        +
        `<th>${name} Budget</th>`
        +
        `<th>${name} Diff</th>`;
    }
  );

  if(
    multiSelected
    ||
    !selected.month.length
  ){

    head +=
      '<th>Total Sales</th>'
      +
      '<th>Total Budget</th>'
      +
      '<th>Total Diff</th>'
      +
      '<th>Achievement %</th>'
      +
      '<th>Status</th>';
  }

  if(el('budgetTableHead')){

    el(
      'budgetTableHead'
    ).innerHTML =
      head;
  }

  if(el('budgetCount')){

    el(
      'budgetCount'
    ).textContent =
      fmt(
        budgetRows.length
      );
  }

  const totalBudgetPages =
    Math.max(
      1,
      Math.ceil(
        budgetRows.length
        /
        budgetPageSize
      )
    );

  budgetPage =
    Math.min(
      budgetPage,
      totalBudgetPages
    );

  const rows =
    budgetRows.slice(
      (
        budgetPage - 1
      )
      *
      budgetPageSize,

      budgetPage
      *
      budgetPageSize
    );

  const body =
    el('budgetTableBody');

  if(!body){
    return;
  }

  if(!rows.length){

    body.innerHTML = `
      <tr>
        <td
          class="empty"
          colspan="${
            4
            +
            showMonths.length * 3
            +
            5
          }"
        >
          No matching budget customers found.
        </td>
      </tr>
    `;

  }else{

    body.innerHTML =
      rows
        .map(
          row => {

            let cells =
              `<td>${esc(row.SalesMan || '')}</td>`
              +
              `<td>${esc(row.Party || '')}</td>`
              +
              `<td>${esc(row.Target || '')}</td>`
              +
              `<td>${esc(row.Order || '')}</td>`;

            showMonths.forEach(
              month => {

                const [
                  budgetKey,
                  salesKey,
                  diffKey
                ] =
                  budgetMonthMap[month];

                cells +=
                  `<td>${money(row[salesKey])}</td>`
                  +
                  `<td>${money(row[budgetKey])}</td>`
                  +
                  `<td class="${diffClass(row[diffKey])}">
                    ${money(row[diffKey])}
                  </td>`;
              }
            );

            if(
              multiSelected
              ||
              !selected.month.length
            ){

              cells +=
                `<td>${money(row.SelectedSales)}</td>`
                +
                `<td>${money(row.SelectedBudget)}</td>`
                +
                `<td class="${diffClass(row.Difference)}">
                  ${money(row.Difference)}
                </td>`
                +
                `<td>${fmt(row.AchievementPct)}%</td>`
                +
                `<td>
                  <span class="budget-status ${
                    row.BudgetStatus === 'ACHIEVED'
                      ? 'ok'
                      : 'bad'
                  }">
                    ${esc(row.BudgetStatus || '')}
                  </span>
                </td>`;
            }

            return `
              <tr>
                ${cells}
              </tr>
            `;
          }
        )
        .join('');
  }

  if(el('budgetPageInfo')){

    el(
      'budgetPageInfo'
    ).textContent =
      `Page ${budgetPage} of ${totalBudgetPages} • ${fmt(budgetRows.length)} customers`;
  }

  if(el('budgetPrev')){

    el(
      'budgetPrev'
    ).disabled =
      budgetPage <= 1;
  }

  if(el('budgetNext')){

    el(
      'budgetNext'
    ).disabled =
      budgetPage >= totalBudgetPages;
  }

  if(el('budgetNote')){

    el(
      'budgetNote'
    ).textContent =
      selected.month.length
        ? `Showing ${
            selected.month
              .map(
                m =>
                  monthNames[m]
                  ||
                  m
              )
              .join(', ')
          } budget vs actual sales.`
        : 'No month selected: showing all available months side-by-side.';
  }
}


/* ==============================
   LOAD BUDGET
============================== */

async function loadBudget(){

  if(
    currentView === 'MainGrp'
    ||
    currentView === 'ItemName'
  ){

    renderBudget();

    return;
  }

  const loading =
    el('budgetLoading');

  if(loading){

    loading.classList.add(
      'show'
    );
  }

  try{

    budgetRows =
      await rpc(
        'raj_customer_budget_report',
        budgetArgs()
      )
      ||
      [];

    renderBudget();

  }catch(error){

    console.error(error);

    if(el('budgetTableBody')){

      el(
        'budgetTableBody'
      ).innerHTML = `
        <tr>
          <td class="empty">
            Budget error:
            ${esc(error.message)}
          </td>
        </tr>
      `;
    }

  }finally{

    if(loading){

      loading.classList.remove(
        'show'
      );
    }
  }
}


/* ==============================
   MAIN DASHBOARD
============================== */

async function loadDashboard(
  reloadFilters = false
){

  const loading =
    el('loading');

  if(loading){

    loading.classList.add(
      'show'
    );
  }

  try{

    const dashboardArgs =
      args();

    const [
      summaryResult,
      rowsResult
    ] =
      await Promise.all(
        [
          rpc(
            'raj_dashboard_summary',
            dashboardArgs
          ),

          rpc(
            'raj_dashboard_rows',
            {
              ...dashboardArgs,

              p_page:
                page,

              p_page_size:
                Number(
                  el('pageSize')
                    ? el('pageSize').value
                    : 25
                )
            }
          )
        ]
      );

    const summary =
      summaryResult?.summary
      ||
      {};

    if(el('totalQty')){

      el('totalQty').textContent =
        fmt(summary.TotalQty);
    }

    if(el('totalTaxable')){

      el('totalTaxable').textContent =
        money(
          summary.TotalTaxable
        );
    }

    if(el('totalSale')){

      el('totalSale').textContent =
        money(
          summary.TotalSale
        );
    }

    if(el('productsSold')){

      el('productsSold').textContent =
        fmt(
          summary.ProductsSold
        );
    }

    if(el('customersBilled')){

      el('customersBilled').textContent =
        fmt(
          summary.CustomersBilled
        );
    }

    if(el('recordCount')){

      el('recordCount').textContent =
        fmt(
          rowsResult?.totalRows
        );
    }

    page =
      Number(
        rowsResult?.page
        ||
        1
      );

    totalPages =
      Number(
        rowsResult?.totalPages
        ||
        1
      );

    if(el('pageInfo')){

      el('pageInfo').textContent =
        `Page ${page} of ${totalPages} • ${fmt(rowsResult?.totalRows)} records`;
    }

    if(el('prevPage')){

      el('prevPage').disabled =
        page <= 1;
    }

    if(el('nextPage')){

      el('nextPage').disabled =
        page >= totalPages;
    }


    /*
      Budget customers / Sales customers /
      Zero Sales customers.
    */

    await loadBudgetMonthSummary();


    /*
      Month summary.
    */

    renderMonths(
      summaryResult?.monthly
      ||
      {}
    );


    /*
      Detailed rows.
    */

    renderRows(
      rowsResult?.rows
      ||
      []
    );


    /*
      Refresh filter options.
    */

    if(reloadFilters){

      await refreshFilters();

      buildMonths();

      await loadODOptions();
    }


    await Promise.all(
      [
        loadGroupSummary(),
        loadBudget(),
        loadComparison()
      ]
    );

  }catch(error){

    console.error(error);

    alert(
      'Dashboard error: '
      +
      error.message
    );

  }finally{

    if(loading){

      loading.classList.remove(
        'show'
      );
    }
  }
}


/* ==============================
   STARTUP
============================== */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    try{

      buildFilterUI();


      /*
        Get schema.
      */

      const schema =
        await rpc(
          'raj_dashboard_schema'
        );

      columns =
        schema?.columns
        ||
        [];

      months =
        schema?.months
        ||
        [];


      /*
        Detailed table header.
      */

      if(el('tableHead')){

        el(
          'tableHead'
        ).innerHTML =

          columns
            .map(
              column =>
                `<th>${esc(column)}</th>`
            )
            .join('')

          +

          '<th>Avg Sales</th>';
      }


      /*
        Build top Month dropdown.
      */

      buildMonths();


      /*
        Global multi dropdown click handler.
      */

      document.addEventListener(
        'click',
        event => {


          const selectAll =
            event.target.closest(
              '[data-select-all]'
            );

          if(selectAll){

            event.preventDefault();
            event.stopPropagation();

            applyBulkSelection(
              selectAll.dataset.selectAll,
              true
            );

            return;
          }


          const unselectAll =
            event.target.closest(
              '[data-unselect-all]'
            );

          if(unselectAll){

            event.preventDefault();
            event.stopPropagation();

            applyBulkSelection(
              unselectAll.dataset.unselectAll,
              false
            );

            return;
          }


          const button =
            event.target.closest(
              '[data-open]'
            );

          if(button){

            const id =
              button.dataset.open;

            const box =
              el(
                'multi_' + id
              );

            if(!box){
              return;
            }

            document
              .querySelectorAll(
                '.multi.open'
              )
              .forEach(
                item => {

                  if(item !== box){

                    item.classList.remove(
                      'open'
                    );
                  }
                }
              );

            box.classList.toggle(
              'open'
            );

            if(
              box.classList.contains(
                'open'
              )
            ){

              const search =
                el(
                  'search_' + id
                );

              if(search){

                search.value =
                  searchState[id]
                  ||
                  '';

                applySearchFilter(id);

                requestAnimationFrame(
                  () => search.focus()
                );
              }
            }

            return;
          }


          if(
            !event.target.closest(
              '.multi'
            )
          ){

            document
              .querySelectorAll(
                '.multi.open'
              )
              .forEach(
                item =>
                  item.classList.remove(
                    'open'
                  )
              );
          }

        }
      );


      /*
        Search boxes.
      */

      for(const [id] of filterDefs){

        wireSearchBox(id);
      }

      wireSearchBox('month');

      wireSearchBox('budgetOD');


      /*
        Initial data.
      */

      await refreshFilters();

      await loadODOptions();

      await loadDashboard();


      /*
        Product Sale Status.
      */

      if(el('productSaleStatus')){

        el(
          'productSaleStatus'
        ).onchange =
          async () => {

            page = 1;

            await loadDashboard(true);
          };
      }


      /*
        Budget status.
      */

      if(el('budgetStatus')){

        el(
          'budgetStatus'
        ).onchange =
          async () => {

            budgetPage = 1;

            await loadBudget();
          };
      }


      /*
        Budget Target.
      */

      if(el('budgetTarget')){

        el(
          'budgetTarget'
        ).onchange =
          async () => {

            budgetPage = 1;

            await loadDashboard(false);
          };
      }


      /*
        Global search.
      */

      if(el('search')){

        el('search').oninput =
          () => {

            clearTimeout(timer);

            timer =
              setTimeout(
                async () => {

                  page = 1;

                  await loadDashboard(true);

                },
                350
              );
          };
      }


      /*
        Detail page size.
      */

      if(el('pageSize')){

        el(
          'pageSize'
        ).onchange =
          async () => {

            page = 1;

            await loadDashboard();
          };
      }


      /*
        Detail previous.
      */

      if(el('prevPage')){

        el(
          'prevPage'
        ).onclick =
          async () => {

            if(page > 1){

              page--;

              await loadDashboard();
            }
          };
      }


      /*
        Detail next.
      */

      if(el('nextPage')){

        el(
          'nextPage'
        ).onclick =
          async () => {

            if(page < totalPages){

              page++;

              await loadDashboard();
            }
          };
      }


      /*
        Budget previous.
      */

      if(el('budgetPrev')){

        el(
          'budgetPrev'
        ).onclick =
          () => {

            if(budgetPage > 1){

              budgetPage--;

              renderBudget();
            }
          };
      }


      /*
        Budget next.
      */

      if(el('budgetNext')){

        el(
          'budgetNext'
        ).onclick =
          () => {

            const pages =
              Math.max(
                1,
                Math.ceil(
                  budgetRows.length
                  /
                  budgetPageSize
                )
              );

            if(budgetPage < pages){

              budgetPage++;

              renderBudget();
            }
          };
      }


      /*
        Clear All.
      */

      if(el('clearFilters')){

        el(
          'clearFilters'
        ).onclick =
          async () => {

            if(el('search')){

              el('search').value =
                '';
            }

            selected.month = [];

            selected.budgetOD = [];

            odParties = [];

            Object
              .keys(searchState)
              .forEach(
                key =>
                  searchState[key] = ''
              );

            if(el('productSaleStatus')){

              el(
                'productSaleStatus'
              ).value =
                'All';
            }

            if(el('budgetStatus')){

              el(
                'budgetStatus'
              ).value =
                'all';
            }

            if(el('budgetTarget')){

              el(
                'budgetTarget'
              ).value =
                'all';
            }

            filters.forEach(
              column => {

                selected[column] = [];

                updateMultiLabel(
                  column
                );
              }
            );

            updateMonthLabel();

            updateODLabel();

            page = 1;

            budgetPage = 1;

            await loadDashboard(true);
          };
      }


      /*
        Analysis Tabs.
      */

      document
        .querySelectorAll(
          '#viewTabs button'
        )
        .forEach(
          button => {

            button.onclick =
              async () => {

                document
                  .querySelectorAll(
                    '#viewTabs button'
                  )
                  .forEach(
                    item =>
                      item.classList.remove(
                        'active'
                      )
                  );

                button.classList.add(
                  'active'
                );

                currentView =
                  button.dataset.view;

                await Promise.all(
                  [
                    loadGroupSummary(),
                    loadBudget()
                  ]
                );
              };
          }
        );


    }catch(error){

      console.error(error);

      alert(
        'Startup error: '
        +
        error.message
        +
        '\nRun required Supabase SQL functions first.'
      );
    }

  }
);
