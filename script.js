/* RAJ AGENCIES script.js - online35 clean table controls */
const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);


/* =====================================================
   FILTER DEFINITIONS
===================================================== */

const filterDefs = [
  ['MainGrp','Main Group','All Main Groups'],
  ['ItemGroup','Item Group','All Item Groups'],
  ['Party','Customer / Party','All Customers'],
  ['ItemCode','Item Code','All Item Codes'],
  ['ItemName','Product / Item Name','All Products'],
  ['SM','SM','All SM'],
  ['Order','OD / Order','All OD'],
  ['Area','Area','All Areas'],
  ['Division','Division','All Divisions'],
  ['City','City','All Cities'],
  ['Pincode','Pincode','All Pincodes']
];

const filters =
  filterDefs.map(x => x[0]);


/* =====================================================
   STATE
===================================================== */

const selected = {};
const searchState = {};

filters.forEach(column => {

  selected[column] = [];
  searchState[column] = '';

});

selected.month = [];
selected.compareMonths = [];

/*
  Backward-compatibility bridge for auth-addon.js.
  Old auth code reads/writes selected.budgetOD.
  It now transparently maps to the real products.Order filter.
*/
Object.defineProperty(
  selected,
  'budgetOD',
  {
    configurable:true,
    get(){
      return selected.Order;
    },
    set(value){
      selected.Order =
        Array.isArray(value)
          ? value
          : [];
    }
  }
);

searchState.month = '';
searchState.compareMonths = '';

let columns = [];
let months = [];

let page = 1;
let totalPages = 1;

let currentView = 'Party';

let analysisPageSize = 25;
let analysisPage = 1;

let timer = null;

let budgetPage = 1;
let budgetRows = [];

let budgetScopeParties = [];

let budgetMonthStats = {};

let budgetPageSize = 25;


/* =====================================================
   MONTH NAMES
===================================================== */

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


/* =====================================================
   BUDGET MONTH MAP
===================================================== */

const budgetMonthMap = {

  Apr:[
    'AprBudget',
    'AprSales',
    'AprDiff'
  ],

  May:[
    'MayBudget',
    'MaySales',
    'MayDiff'
  ],

  Jun:[
    'JuneBudget',
    'JuneSales',
    'JuneDiff'
  ],

  June:[
    'JuneBudget',
    'JuneSales',
    'JuneDiff'
  ],

  Jul:[
    'JulyBudget',
    'JulySales',
    'JulyDiff'
  ],

  July:[
    'JulyBudget',
    'JulySales',
    'JulyDiff'
  ],

  Aug:[
    'AugBudget',
    'AugSales',
    'AugDiff'
  ],

  Sep:[
    'SepBudget',
    'SepSales',
    'SepDiff'
  ],

  Sept:[
    'SepBudget',
    'SepSales',
    'SepDiff'
  ]

};


/* =====================================================
   HELPERS
===================================================== */

const el = id =>
  document.getElementById(id);


const fmt = value =>

  new Intl.NumberFormat(
    'en-IN',
    {
      maximumFractionDigits:2
    }
  ).format(
    Number(value || 0)
  );


const money = value =>

  '₹' +

  new Intl.NumberFormat(
    'en-IN',
    {
      minimumFractionDigits:2,
      maximumFractionDigits:2
    }
  ).format(
    Number(value || 0)
  );


const esc = value => {

  const div =
    document.createElement('div');

  div.textContent =
    value ?? '';

  return div.innerHTML;

};


/* =====================================================
   RPC
===================================================== */

async function rpc(
  name,
  params = {}
){

  const {
    data,
    error
  } =
    await sb.rpc(
      name,
      params
    );


  if(error){

    throw error;

  }


  return data;

}


/* =====================================================
   MONTH HELPERS
===================================================== */

function normalizeMonth(month){

  if(month === 'Jun'){
    return 'June';
  }

  if(month === 'Jul'){
    return 'July';
  }

  if(month === 'Sep'){
    return 'Sept';
  }

  return month;

}


function monthAmountColumn(month){

  const candidates = [

    `${month}Amt`,

    `${normalizeMonth(month)}Amt`,

    month === 'June'
      ? 'JuneAmt'
      : '',

    month === 'July'
      ? 'JulyAmt'
      : '',

    month === 'Sept'
      ? 'SeptAmt'
      : ''

  ].filter(Boolean);


  return (

    candidates.find(
      column =>
        columns.includes(column)
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


/* =====================================================
   BASE NORMAL FILTER OBJECT

   This contains only filters user actually selected.
   No budget-generated Party list.
===================================================== */

function normalFilterObject(){

  const obj = {};


  for(const column of filters){

    if(selected[column].length){

      obj[column] =
        [...selected[column]];

    }

  }


  return obj;

}


/* =====================================================
   IS TARGET / BUDGET STATUS CUSTOMER SCOPE ACTIVE?
===================================================== */

function budgetSalesScopeIsActive(){

  const targetMode =
    el('budgetTarget')
      ? el('budgetTarget').value
      : 'all';


  const status =
    el('budgetStatus')
      ? el('budgetStatus').value
      : 'all';


  return (

    targetMode !== 'all'

    ||

    status !== 'all'

  );

}


/* =====================================================
   RAW BUDGET ARGS

   SAME selected SM goes to budget_customer SalesMan
   and SQL also applies it to products.SM.
===================================================== */

const rawBudgetArgs = () => ({

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
    selected.Order.length
      ? selected.Order
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


/* =====================================================
   TARGET / STATUS -> MATCHED PRODUCT PARTIES
===================================================== */

async function refreshBudgetSalesScope(){

  if(!budgetSalesScopeIsActive()){

    budgetScopeParties = [];

    return;

  }


  const data =
    await rpc(
      'raj_budget_sales_scope_parties',
      rawBudgetArgs()
    );


  budgetScopeParties =

    Array.isArray(data)

      ? data
          .map(
            value =>
              String(
                value ?? ''
              ).trim()
          )
          .filter(Boolean)

      : [];

}


/* =====================================================
   FINAL SALES FILTER OBJECT

   IMPORTANT:
   SM IS ALWAYS KEPT.

   Example:
   SM = Bh + Target
   =>
   products.SM = Bh
   AND Party in Bh Target customer Party scope

   SM = Sr + Target
   =>
   products.SM = Sr
   AND Party in Sr Target customer Party scope
===================================================== */

function effectiveFilterObject(){

  const obj =
    normalFilterObject();


  let partyScope = null;


  /*
    Manual Party selection.
  */

  if(selected.Party.length){

    partyScope =
      [...selected.Party];

  }


  /*
    Target / Budget Status scope.
  */

  if(budgetSalesScopeIsActive()){

    const allowed =
      new Set(
        budgetScopeParties.map(
          value =>
            String(value)
        )
      );


    if(partyScope){

      partyScope =
        partyScope.filter(
          party =>
            allowed.has(
              String(party)
            )
        );

    }else{

      partyScope =
        [...budgetScopeParties];

    }

  }


  if(partyScope !== null){

    obj.Party =

      partyScope.length

        ? partyScope

        : [
            '__RAJ_NO_MATCHING_PARTY__'
          ];

  }


  /*
    CRITICAL:
    Never remove SM here.
  */

  if(selected.SM.length){

    obj.SM =
      [...selected.SM];

  }


  return obj;

}


/* =====================================================
   FILTER OPTION OBJECT
===================================================== */

function filterObjectForOptions(column){

  const obj =
    effectiveFilterObject();


  /*
    Current filter itself removed
    so other values remain visible.
  */

  delete obj[column];


  /*
    When user opens SM dropdown while Target is active,
    don't lock SM list to current target-derived Party scope.

    This allows user to change:
    Bh -> Sr -> any other SM.
  */

  if(
    column === 'SM'
    &&
    budgetSalesScopeIsActive()
  ){

    if(selected.Party.length){

      obj.Party =
        [...selected.Party];

    }else{

      delete obj.Party;

    }

  }


  /*
    Party options should respect target/status scope.
  */

  if(column === 'Party'){

    if(budgetSalesScopeIsActive()){

      obj.Party =

        budgetScopeParties.length

          ? [...budgetScopeParties]

          : [
              '__RAJ_NO_MATCHING_PARTY__'
            ];

    }else{

      delete obj.Party;

    }

  }


  return obj;

}


/* =====================================================
   MAIN SALES ARGS
===================================================== */

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


/* =====================================================
   COMPARISON ARGS
===================================================== */

const comparisonBaseArgs = () => ({

  p_filters:
    effectiveFilterObject(),

  p_months:[],

  p_sale_status:
    el('productSaleStatus')
      ? el('productSaleStatus').value
      : 'All',

  p_search:
    el('search')
      ? el('search').value.trim()
      : ''

});


/* =====================================================
   FILTER VALUES ARGS
===================================================== */

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


/* =====================================================
   CUSTOMER BUDGET ARGS
===================================================== */

const budgetArgs = () =>
  rawBudgetArgs();


/* =====================================================
   MONTH BUDGET SUMMARY ARGS

   Important:
   use normal selected filters,
   NOT target-generated Party list.

   This preserves Zero Sales Budget Customers.
===================================================== */

const budgetSummaryArgs = () => ({

  p_filters:
    normalFilterObject(),

  p_ods:
    selected.Order.length
      ? selected.Order
      : null,

  p_target_mode:
    el('budgetTarget')
      ? el('budgetTarget').value
      : 'all',

  p_search:
    el('search')
      ? el('search').value.trim()
      : ''

});


/* =====================================================
   BULK BUTTONS
===================================================== */

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


/* =====================================================
   BUILD FILTER UI
===================================================== */

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

        `
      )
      .join('');

}


/* =====================================================
   LABELS
===================================================== */

function updateMultiLabel(column){

  const def =
    filterDefs.find(
      x => x[0] === column
    );


  const label =
    el(
      'label_' + column
    );


  const chips =
    el(
      'chips_' + column
    );


  if(label){

    label.textContent =

      selected[column].length

        ? `${selected[column].length} selected`

        : def[2];

  }


  if(chips){

    chips.innerHTML =

      selected[column]
        .slice(0,4)
        .map(
          value =>
            `<span class="chip">${esc(value)}</span>`
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

  const label =
    el('label_month');

  const chips =
    el('chips_month');


  if(label){

    label.textContent =

      selected.month.length

        ? `${selected.month.length} selected`

        : 'All Months / Total';

  }


  if(chips){

    chips.innerHTML =

      selected.month
        .map(
          month =>
            `<span class="chip">${esc(monthNames[month] || month)}</span>`
        )
        .join('');

  }

}


function updateODLabel(){

  /*
    Backward-compatibility for the current auth addon.
    OD is now the main products.Order filter.
  */

  updateMultiLabel(
    'Order'
  );

}


function updateCompareLabel(){

  const label =
    el('label_compareMonths');

  const chips =
    el('chips_compareMonths');


  if(label){

    label.textContent =

      selected.compareMonths.length

        ? `${selected.compareMonths.length} selected`

        : 'Select Compare Months';

  }


  if(chips){

    chips.innerHTML =

      selected.compareMonths
        .map(
          month =>
            `<span class="chip">${esc(monthNames[month] || month)}</span>`
        )
        .join('');

  }

}


/* =====================================================
   OPTION VALUES
===================================================== */

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
      checkbox =>

        !visibleOnly

        ||

        checkbox
          .closest('.multi-option')
          ?.style
          .display !== 'none'
    )
    .map(
      checkbox =>
        checkbox.value
    );

}


/* =====================================================
   SEARCHABLE MULTI SELECT
===================================================== */

function applySearchFilter(id){

  const search =
    el(
      'search_' + id
    );


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
            option.dataset.text
            ||
            ''
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
    el(
      'search_' + id
    );

  const multi =
    el(
      'multi_' + id
    );


  if(search){

    search.value =
      searchState[id]
      ||
      '';

  }


  applySearchFilter(id);


  if(multi){

    multi.classList.add(
      'open'
    );

  }


  if(search){

    requestAnimationFrame(
      () => {

        search.focus();

        const length =
          search.value.length;


        try{

          search.setSelectionRange(
            length,
            length
          );

        }catch(_){}

      }
    );

  }

}


function wireSearchBox(id){

  const search =
    el(
      'search_' + id
    );


  if(!search){

    return;

  }


  search.value =
    searchState[id]
    ||
    '';


  search.oninput =
    () => {

      searchState[id] =
        search.value;

      applySearchFilter(id);

    };

}


/* =====================================================
   BULK SELECTION
===================================================== */

async function applyBulkSelection(
  id,
  selectAll
){

  const visibleOnly =
    Boolean(
      (
        searchState[id]
        ||
        ''
      ).trim()
    );


  if(id === 'compareMonths'){

    selected.compareMonths =

      selectAll

        ? valuesFromOptions(
            'compareMonths',
            visibleOnly
          )

        : [];


    updateCompareLabel();

    buildComparisonControls();

    await loadComparison();

    restoreOpenFilter(
      'compareMonths'
    );

    return;

  }


  if(id === 'month'){

    selected.month =

      selectAll

        ? valuesFromOptions(
            'month',
            visibleOnly
          )

        : [];


    updateMonthLabel();

    buildMonths();

    page = 1;
    budgetPage = 1;

    await loadDashboard(false);

    await refreshPartyFilterOnly();

    restoreOpenFilter(
      'month'
    );

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


  updateMultiLabel(id);

  page = 1;
  budgetPage = 1;

  await loadDashboard(false);

  if(id !== 'Party'){
    await refreshPartyFilterOnly();
  }

  restoreOpenFilter(id);

}


/* =====================================================
   BUILD MAIN MONTHS
===================================================== */

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
                monthNames[month]
                ||
                month
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
              ${esc(monthNames[month] || month)}
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

            await loadDashboard(false);

            await refreshPartyFilterOnly();

            restoreOpenFilter(
              'month'
            );

          };

      }
    );


  applySearchFilter(
    'month'
  );

}


/* =====================================================
   COMPARISON CONTROLS
===================================================== */

function buildComparisonControls(){

  const box =
    el(
      'options_compareMonths'
    );


  const actual =
    el(
      'actualCompareMonth'
    );


  if(box){

    box.innerHTML =

      bulkButtons(
        'compareMonths'
      )

      +

      months
        .map(
          month => `

            <label
              class="multi-option"
              data-text="${esc(
                (
                  monthNames[month]
                  ||
                  month
                ).toLowerCase()
              )}"
            >

              <input
                type="checkbox"
                value="${esc(month)}"
                ${
                  selected.compareMonths.includes(
                    String(month)
                  )
                    ? 'checked'
                    : ''
                }
              >

              <span>
                ${esc(monthNames[month] || month)}
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
                  !selected.compareMonths.includes(
                    checkbox.value
                  )
                ){

                  selected.compareMonths.push(
                    checkbox.value
                  );

                }

              }else{

                selected.compareMonths =

                  selected.compareMonths.filter(
                    month =>
                      month !== checkbox.value
                  );

              }


              updateCompareLabel();

              await loadComparison();

              restoreOpenFilter(
                'compareMonths'
              );

            };

        }
      );


    applySearchFilter(
      'compareMonths'
    );

  }


  if(actual){

    const oldValue =
      actual.value;


    actual.innerHTML =

      '<option value="">Select Actual Month</option>'

      +

      months
        .map(
          month =>

            `<option value="${esc(month)}">${esc(monthNames[month] || month)}</option>`

        )
        .join('');


    if(
      months.includes(
        oldValue
      )
    ){

      actual.value =
        oldValue;

    }

  }

}


/* =====================================================
   FILTER VALUES
===================================================== */

async function loadFilter(column){

  const data =
    await rpc(
      'raj_filter_values',
      {

        p_column:
          column,

        ...filterArgs(column)

      }
    );


  const box =
    el(
      'options_' + column
    );


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
              String(
                value
                ??
                ''
              )
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
              String(value)
                .toLowerCase()
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


            updateMultiLabel(
              column
            );


            page = 1;
            budgetPage = 1;


            await loadDashboard(false);

            if(column !== 'Party'){
              await refreshPartyFilterOnly();
            }

            restoreOpenFilter(
              column
            );

          };

      }
    );


  applySearchFilter(
    column
  );

}


async function refreshFilters(){

  for(const column of filters){

    await loadFilter(column);

  }

}


/* =====================================================
   LIGHTWEIGHT CUSTOMER LINK REFRESH

   After a filter changes we do NOT reload every dropdown.
   That caused many RPC calls and statement timeout.

   We refresh only Customer / Party immediately.
   Other dropdowns refresh themselves when opened.
===================================================== */

async function refreshPartyFilterOnly(){

  try{

    await loadFilter(
      'Party'
    );

  }catch(error){

    console.error(
      'Party filter refresh error:',
      error
    );

  }

}


/* =====================================================
   BUDGET MONTH SUMMARY
===================================================== */

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


        TotalBudget:

          Number(
            row.TotalBudget
            ??
            row.totalbudget
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
          ),


        ZeroSalesBudget:

          Number(
            row.ZeroSalesBudget
            ??
            row.zerosalesbudget
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


/* =====================================================
   SAFE BUDGET STATS
===================================================== */

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
      TotalBudget:0,
      ZeroSalesCustomers:0,
      ZeroSalesBudget:0
    }

  );

}


/* =====================================================
   MONTH SUMMARY
===================================================== */

function renderMonths(monthData){

  const container =
    el('monthlyCards');


  if(!container){

    return;

  }


  const activeMonths =
    activeAverageMonths();


  const averageTotal =

    activeMonths.reduce(
      (total,month) =>

        total

        +

        Number(
          monthData?.[month]?.Sale
          ||
          0
        ),

      0
    );


  const averageSale =

    activeMonths.length

      ? averageTotal
        /
        activeMonths.length

      : 0;


  const budgetMonths =

    selected.month.length

      ? selected.month

      : months;


  let totalBudget = 0;
  let zeroBudget = 0;


  for(const month of budgetMonths){

    const stats =
      budgetStatsForMonth(month);


    totalBudget +=
      Number(
        stats.TotalBudget
        ||
        0
      );


    zeroBudget +=
      Number(
        stats.ZeroSalesBudget
        ||
        0
      );

  }


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
          ${fmt(activeMonths.length)}
        </b>

      </div>

      <div class="metric">

        <span>
          Avg Sales
        </span>

        <b>
          ${money(averageSale)}
        </b>

      </div>

    </div>

  `;


  const budgetOverview = `

    <div class="month-card budget-overview-card">

      <h4>
        Filtered Budget Overview
      </h4>

      <div class="metric">

        <span>
          Period
        </span>

        <b>

          ${
            selected.month.length

              ? selected.month
                  .map(
                    month =>
                      monthNames[month]
                      ||
                      month
                  )
                  .join(', ')

              : 'All Available Months'
          }

        </b>

      </div>

      <div class="metric">

        <span>
          Total Budget
        </span>

        <b>
          ${money(totalBudget)}
        </b>

      </div>

      <div class="metric">

        <span>
          Zero Sales Budget
        </span>

        <b>
          ${money(zeroBudget)}
        </b>

      </div>

    </div>

  `;


  const cards =

    months
      .map(
        month => {

          const sales =
            monthData?.[month]
            ||
            {};


          const budget =
            budgetStatsForMonth(month);


          return `

            <div class="month-card">

              <h4>
                ${esc(monthNames[month] || month)}
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
                <b>${fmt(budget.BudgetCustomers)}</b>
              </div>

              <div class="metric">
                <span>Total Budget</span>
                <b>${money(budget.TotalBudget)}</b>
              </div>

              <div class="metric">
                <span>Zero Sales Customers</span>
                <b>${fmt(budget.ZeroSalesCustomers)}</b>
              </div>

              <div class="metric">
                <span>Zero Sales Budget</span>
                <b>${money(budget.ZeroSalesBudget)}</b>
              </div>

            </div>

          `;

        }
      )
      .join('');


  container.innerHTML =

    averageCard

    +

    budgetOverview

    +

    cards;

}


/* =====================================================
   DETAIL TABLE
===================================================== */

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
          colspan="${Math.max(columns.length + 1,1)}"
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

          const cells =

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


          return `

            <tr>

              ${cells}

              <td>
                ${money(rowAverageSale(row))}
              </td>

            </tr>

          `;

        }
      )
      .join('');

}


/* =====================================================
   ANALYSIS VIEW
   TAXABLE SALES
===================================================== */

async function loadGroupSummary(){

  const body =
    el('groupSummaryBody');

  if(!body){
    return;
  }

  const table =
    body.closest('table');

  const headRow =
    table
      ?.querySelector(
        'thead tr'
      );

  if(!headRow){
    return;
  }

  const analysisMonths =
    activeAverageMonths();

  /*
    Customer Wise already represents one customer per row,
    so repeating monthly "Customers Billed = 1" is not useful.

    All other Analysis views show:
    Month Taxable Sale + Month Customers Billed
    and Avg Taxable Sale + Avg Customers Billed.
  */
  const showMonthlyCustomers =
    currentView !== 'Party';

  try{

    const results =

      await Promise.all(
        [

          rpc(
            'raj_group_summary',
            {
              p_view:
                currentView,

              ...args()
            }
          ),

          ...analysisMonths.map(
            month =>
              rpc(
                'raj_group_summary',
                {
                  p_view:
                    currentView,

                  ...args(),

                  p_months:[
                    month
                  ]
                }
              )
          )

        ]
      );

    const totalData =
      results[0]
      ||
      [];

    const monthlyData =
      results.slice(1);

    const viewName =

      ({

        Party:'Customer / Party',

        MainGrp:'Company / Main Group',

        ItemName:'Product / Item Name',

        SM:'SM',

        Division:'Division',

        Area:'Area',

        City:'City',

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
            ${esc(monthNames[month] || month)}
            Taxable Sale
          </th>

        `;

        if(showMonthlyCustomers){

          header += `

            <th>
              ${esc(monthNames[month] || month)}
              Customers Billed
            </th>

          `;

        }

      }
    );

    header +=
      '<th>Avg Taxable Sale</th>';

    if(showMonthlyCustomers){

      header +=
        '<th>Avg Customers Billed</th>';

    }

    header +=

      '<th>Qty</th>'

      +

      '<th>Total Taxable Sale</th>'

      +

      '<th>Products Sold</th>'

      +

      '<th>Total Customers Billed</th>'

      +

      '<th>Records</th>';

    headRow.innerHTML =
      header;

    /*
      Mark the first Analysis column as sticky.
      CSS also keeps the complete header row sticky.
    */
    if(table){
      table.classList.add(
        'analysis-sticky-table'
      );
    }

    if(!totalData.length){

      const fixedColumns = 6;
      const monthColumns =
        analysisMonths.length
        *
        (
          showMonthlyCustomers
            ? 2
            : 1
        );

      const averageColumns =
        showMonthlyCustomers
          ? 2
          : 1;

      body.innerHTML = `

        <tr>

          <td
            class="empty"
            colspan="${
              1
              +
              monthColumns
              +
              averageColumns
              +
              fixedColumns
            }"
          >
            No summary data found.
          </td>

        </tr>

      `;

      return;

    }

    /*
      Each month map stores BOTH Taxable Sale and distinct
      Customers Billed returned by raj_group_summary.
    */
    const monthMaps =

      monthlyData.map(
        rows => {

          const map =
            new Map();

          (rows || [])
            .forEach(
              row => {

                map.set(
                  String(row.label),

                  {
                    taxable:
                      Number(
                        row.taxable
                        ||
                        0
                      ),

                    customers:
                      Number(
                        row.customersBilled
                        ??
                        row.customersbilled
                        ??
                        0
                      )
                  }
                );

              }
            );

          return map;

        }
      );

    const analysisTotalPages =
      Math.max(1, Math.ceil(totalData.length / analysisPageSize));

    if(analysisPage > analysisTotalPages){
      analysisPage = analysisTotalPages;
    }

    const analysisStart = (analysisPage - 1) * analysisPageSize;
    const analysisRows = totalData.slice(
      analysisStart,
      analysisStart + analysisPageSize
    );

    if(el('analysisPageInfo')){
      el('analysisPageInfo').textContent =
        `Page ${analysisPage} of ${analysisTotalPages} • ${fmt(totalData.length)} groups`;
    }

    if(el('analysisPrev')) el('analysisPrev').disabled = analysisPage <= 1;
    if(el('analysisNext')) el('analysisNext').disabled = analysisPage >= analysisTotalPages;

    body.innerHTML =

      analysisRows
        .map(
          row => {

            const monthStats =

              analysisMonths.map(
                (month,index) =>

                  monthMaps[index]
                    ?.get(
                      String(row.label)
                    )

                  ||

                  {
                    taxable:0,
                    customers:0
                  }
              );

            const monthSales =
              monthStats.map(
                stat =>
                  Number(
                    stat.taxable
                    ||
                    0
                  )
              );

            const monthCustomers =
              monthStats.map(
                stat =>
                  Number(
                    stat.customers
                    ||
                    0
                  )
              );

            const avgTaxable =

              monthSales.length

                ? monthSales.reduce(
                    (
                      total,
                      value
                    ) =>
                      total + value,

                    0
                  )
                  /
                  monthSales.length

                : 0;

            const avgCustomers =

              monthCustomers.length

                ? monthCustomers.reduce(
                    (
                      total,
                      value
                    ) =>
                      total + value,

                    0
                  )
                  /
                  monthCustomers.length

                : 0;

            const monthCells =

              monthStats
                .map(
                  stat => {

                    let cells =
                      `<td>${money(stat.taxable)}</td>`;

                    if(showMonthlyCustomers){

                      cells +=
                        `<td>${fmt(stat.customers)}</td>`;

                    }

                    return cells;

                  }
                )
                .join('');

            return `

              <tr>

                <td>
                  ${esc(row.label)}
                </td>

                ${monthCells}

                <td>
                  ${money(avgTaxable)}
                </td>

                ${
                  showMonthlyCustomers

                    ? `
                      <td>
                        ${fmt(avgCustomers)}
                      </td>
                    `

                    : ''
                }

                <td>
                  ${fmt(row.qty)}
                </td>

                <td>
                  ${money(row.taxable)}
                </td>

                <td>
                  ${fmt(row.productsSold)}
                </td>

                <td>
                  ${
                    fmt(
                      row.customersBilled
                      ??
                      row.customersbilled
                      ??
                      0
                    )
                  }
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
      'Analysis error:',
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


/* =====================================================
   SALES COMPARISON
   TAXABLE SALES
===================================================== */

async function loadComparison(){

  const actualMonth =
    el('actualCompareMonth')
      ?.value
    ||
    '';


  const compareMonths =
    [...selected.compareMonths];


  const setText =
    (id,value) => {

      const node =
        el(id);

      if(node){

        node.textContent =
          value;

      }

    };


  const status =
    el(
      'compareStatus'
    );


  if(
    !compareMonths.length
    ||
    !actualMonth
  ){

    setText(
      'compareMonthsText',
      'Select months'
    );

    setText(
      'compareActualMonth',

      actualMonth

        ? monthNames[actualMonth]
          ||
          actualMonth

        : '-'
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


    if(status){

      status.textContent =
        'Select months';

      status.className =
        'compare-neutral';

    }


    return;

  }


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
      comparisonBaseArgs();


    const compareResults =

      await Promise.all(
        compareMonths.map(
          month =>
            rpc(
              'raj_dashboard_summary',
              {

                ...baseArgs,

                p_months:[
                  month
                ]

              }
            )
        )
      );


    const actualResult =

      await rpc(
        'raj_dashboard_summary',
        {

          ...baseArgs,

          p_months:[
            actualMonth
          ]

        }
      );


    const compareSales =

      compareResults.map(
        result =>

          Number(
            result
              ?.summary
              ?.TotalTaxable

            ||

            0
          )
      );


    const compareAvg =

      compareSales.length

        ? compareSales.reduce(
            (
              total,
              sale
            ) =>
              total + sale,

            0
          )
          /
          compareSales.length

        : 0;


    const actualSale =

      Number(
        actualResult
          ?.summary
          ?.TotalTaxable

        ||

        0
      );


    const difference =
      actualSale
      -
      compareAvg;


    const percentage =

      compareAvg !== 0

        ? (
            difference
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
        difference > 0
          ? '+'
          : ''
      )

      +

      money(difference)
    );


    setText(
      'comparePercent',

      (
        percentage > 0
          ? '+'
          : ''
      )

      +

      fmt(percentage)

      +

      '%'
    );


    if(status){

      if(difference > 0){

        status.textContent =
          'Above Avg';

        status.className =
          'compare-positive';

      }else if(difference < 0){

        status.textContent =
          'Below Avg';

        status.className =
          'compare-negative';

      }else{

        status.textContent =
          'Equal to Avg';

        status.className =
          'compare-neutral';

      }

    }


  }catch(error){

    console.error(
      'Comparison error:',
      error
    );


    if(status){

      status.textContent =
        'Comparison error';

      status.className =
        'compare-negative';

    }

  }

}


/* =====================================================
   CUSTOMER BUDGET HELPERS
===================================================== */

function budgetMonthsToShow(){

  const chosen =
    selected.month.length

      ? selected.month

      : months;


  const result = [];


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
      !result.includes(key)
    ){

      result.push(
        key
      );

    }

  }


  return result;

}


function diffClass(value){

  return Number(
    value || 0
  ) < 0

    ? 'budget-negative'

    : 'budget-positive';

}


/* =====================================================
   RENDER CUSTOMER BUDGET
===================================================== */

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


  const totalPagesBudget =

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
      totalPagesBudget
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
    el(
      'budgetTableBody'
    );


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

      `Page ${budgetPage} of ${totalPagesBudget} • ${fmt(budgetRows.length)} customers`;

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
      budgetPage >= totalPagesBudget;

  }

}


/* =====================================================
   LOAD CUSTOMER BUDGET
===================================================== */

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

    console.error(
      'Budget error:',
      error
    );


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


/* =====================================================
   MAIN DASHBOARD
===================================================== */

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

    /*
      First build correct Target / Budget Status customer scope.
    */

    await refreshBudgetSalesScope();


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

      el(
        'totalQty'
      ).textContent =
        fmt(
          summary.TotalQty
        );

    }


    if(el('totalTaxable')){

      el(
        'totalTaxable'
      ).textContent =
        money(
          summary.TotalTaxable
        );

    }


    if(el('totalSale')){

      el(
        'totalSale'
      ).textContent =
        money(
          summary.TotalSale
        );

    }


    if(el('productsSold')){

      el(
        'productsSold'
      ).textContent =
        fmt(
          summary.ProductsSold
        );

    }


    if(el('customersBilled')){

      el(
        'customersBilled'
      ).textContent =
        fmt(
          summary.CustomersBilled
        );

    }


    if(el('recordCount')){

      el(
        'recordCount'
      ).textContent =
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

      el(
        'pageInfo'
      ).textContent =

        `Page ${page} of ${totalPages} • ${fmt(rowsResult?.totalRows)} records`;

    }


    if(el('prevPage')){

      el(
        'prevPage'
      ).disabled =
        page <= 1;

    }


    if(el('nextPage')){

      el(
        'nextPage'
      ).disabled =
        page >= totalPages;

    }


    await loadBudgetMonthSummary();


    renderMonths(
      summaryResult?.monthly
      ||
      {}
    );


    renderRows(
      rowsResult?.rows
      ||
      []
    );


    if(reloadFilters){

      await refreshFilters();

      buildMonths();


    }


    await Promise.all(
      [

        loadGroupSummary(),

        loadBudget(),

        loadComparison()

      ]
    );


  }catch(error){

    console.error(
      error
    );


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


/* =====================================================
   STARTUP
===================================================== */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    try{


      buildFilterUI();


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


      buildMonths();

      buildComparisonControls();


      /* GLOBAL DROPDOWN */

      document.addEventListener(
        'click',
        async event => {


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


            const multi =
              el(
                'multi_' + id
              );


            if(!multi){

              return;

            }


            /*
              Always reload the dropdown being opened
              using the latest selected filters.

              This is especially important for Party:
              Order / SM / Area / City / Company etc.
              must be reflected immediately, even if an
              earlier dashboard refresh was interrupted.
            */
            if(filters.includes(id)){

              try{

                await loadFilter(id);

              }catch(error){

                console.error(
                  `Filter refresh error (${id}):`,
                  error
                );

              }

            }


            document
              .querySelectorAll(
                '.multi.open'
              )
              .forEach(
                item => {

                  if(item !== multi){

                    item.classList.remove(
                      'open'
                    );

                  }

                }
              );


            multi.classList.toggle(
              'open'
            );


            if(
              multi.classList.contains(
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


                applySearchFilter(
                  id
                );


                requestAnimationFrame(
                  () =>
                    search.focus()
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


      /* SEARCH BOXES */

      for(const [id] of filterDefs){

        wireSearchBox(id);

      }


      wireSearchBox('month');
      wireSearchBox('compareMonths');


      /* INITIAL LOAD */

      await refreshFilters();


      await loadDashboard();


      /* ACTUAL COMPARE MONTH */

      if(el('actualCompareMonth')){

        el(
          'actualCompareMonth'
        ).onchange =
          async () => {

            await loadComparison();

          };

      }


      /* PRODUCT SALE */

      if(el('productSaleStatus')){

        el(
          'productSaleStatus'
        ).onchange =
          async () => {

            page = 1;

            await loadDashboard(false);

            await refreshPartyFilterOnly();

          };

      }


      /*
        BUDGET STATUS
        also filters sales.
      */

      if(el('budgetStatus')){

        el(
          'budgetStatus'
        ).onchange =
          async () => {

            page = 1;
            budgetPage = 1;

            await loadDashboard(false);

            await refreshPartyFilterOnly();

          };

      }


      /*
        TARGET
        also filters sales.
      */

      if(el('budgetTarget')){

        el(
          'budgetTarget'
        ).onchange =
          async () => {

            page = 1;
            budgetPage = 1;

            await loadDashboard(false);

            await refreshPartyFilterOnly();

          };

      }


      /* GLOBAL SEARCH */

      if(el('search')){

        el(
          'search'
        ).oninput =
          () => {

            clearTimeout(
              timer
            );


            timer =
              setTimeout(
                async () => {

                  page = 1;

                  await loadDashboard(false);

                  await refreshPartyFilterOnly();

                },
                350
              );

          };

      }


      /* ANALYSIS ROW CONTROLS */

      if(el('analysisPageSize')){
        el('analysisPageSize').onchange = async () => {
          analysisPageSize = Number(el('analysisPageSize').value || 25);
          analysisPage = 1;
          await loadGroupSummary();
        };
      }

      if(el('analysisPrev')){
        el('analysisPrev').onclick = async () => {
          if(analysisPage > 1){
            analysisPage--;
            await loadGroupSummary();
          }
        };
      }

      if(el('analysisNext')){
        el('analysisNext').onclick = async () => {
          analysisPage++;
          await loadGroupSummary();
        };
      }


      /* PAGE SIZE */

      if(el('pageSize')){

        el(
          'pageSize'
        ).onchange =
          async () => {

            page = 1;

            await loadDashboard();

          };

      }


      /* PREVIOUS */

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


      /* NEXT */

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


      /* BUDGET PAGE SIZE */

      if(el('budgetPageSize')){

        el(
          'budgetPageSize'
        ).onchange =
          () => {

            budgetPage = 1;

            budgetPageSize =
              Number(
                el('budgetPageSize').value
                ||
                25
              );

            renderBudget();

          };

      }


      /* BUDGET PREV */

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


      /* BUDGET NEXT */

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


      /* CLEAR ALL */

      if(el('clearFilters')){

        el(
          'clearFilters'
        ).onclick =
          async () => {


            if(el('search')){

              el(
                'search'
              ).value =
                '';

            }


            selected.month = [];
            selected.compareMonths = [];

            budgetScopeParties = [];


            Object
              .keys(
                searchState
              )
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


            if(el('actualCompareMonth')){

              el(
                'actualCompareMonth'
              ).value =
                '';

            }


            filters.forEach(
              column => {

                selected[column] =
                  [];

                updateMultiLabel(
                  column
                );

              }
            );


            updateMonthLabel();


            updateCompareLabel();


            page = 1;
            budgetPage = 1;


            buildComparisonControls();


            await loadDashboard(false);

            await refreshPartyFilterOnly();

          };

      }


      /* ANALYSIS TABS */

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

                analysisPage = 1;


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

      console.error(
        error
      );


      alert(

        'Startup error: '

        +

        error.message

        +

        '\nRequired Supabase SQL functions must exist.'

      );

    }

  }
);
