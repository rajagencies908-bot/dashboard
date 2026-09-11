const { createClient } = supabase;


const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);



/* =========================================
   FILTER DEFINITIONS
========================================= */

const filterDefs = [

  [
    'MainGrp',
    'Main Group',
    'All Main Groups'
  ],

  [
    'ItemGroup',
    'Item Group',
    'All Item Groups'
  ],

  [
    'Party',
    'Customer / Party',
    'All Customers'
  ],

  [
    'ItemCode',
    'Item Code',
    'All Item Codes'
  ],

  [
    'ItemName',
    'Product / Item Name',
    'All Products'
  ],

  [
    'SM',
    'SM',
    'All SM'
  ],

  [
    'Division',
    'Division',
    'All Divisions'
  ],

  [
    'City',
    'City',
    'All Cities'
  ],

  [
    'Pincode',
    'Pincode',
    'All Pincodes'
  ]

];


const filters =
  filterDefs.map(
    x => x[0]
  );



/* =========================================
   STATE
========================================= */

const selected = {};

const searchState = {};


filters.forEach(
  f => {

    selected[f] = [];

    searchState[f] = '';

  }
);


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



/* =========================================
   MONTH NAMES
========================================= */

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



/* =========================================
   BUDGET MONTH MAP
========================================= */

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



/* =========================================
   BASIC HELPERS
========================================= */

const el =
  id =>
    document.getElementById(
      id
    );



const fmt =
  n =>
    new Intl.NumberFormat(
      'en-IN',
      {
        maximumFractionDigits:2
      }
    ).format(
      Number(
        n || 0
      )
    );



const money =
  n =>
    '₹'
    +
    new Intl.NumberFormat(
      'en-IN',
      {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }
    ).format(
      Number(
        n || 0
      )
    );



const esc =
  v => {

    const d =
      document.createElement(
        'div'
      );


    d.textContent =
      v ?? '';


    return d.innerHTML;

  };



/* =========================================
   RPC HELPER
========================================= */

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


  if(
    error
  ){

    throw error;

  }


  return data;

}



/* =========================================
   MONTH HELPERS
========================================= */

function normalizeMonth(
  month
){

  if(
    month === 'Jun'
  ){

    return 'June';

  }


  if(
    month === 'Jul'
  ){

    return 'July';

  }


  if(
    month === 'Sep'
  ){

    return 'Sept';

  }


  return month;

}



function monthAmountColumn(
  month
){

  const candidates = [


    `${month}Amt`,


    `${normalizeMonth(
      month
    )}Amt`,


    month === 'June'
      ? 'JuneAmt'
      : '',


    month === 'July'
      ? 'JulyAmt'
      : '',


    month === 'Sept'
      ? 'SeptAmt'
      : ''


  ].filter(
    Boolean
  );


  return candidates.find(
    c =>
      columns.includes(
        c
      )
  )
  ||
  null;

}



function activeAverageMonths(){

  return selected.month.length

    ? selected.month

    : months;

}



function rowAverageSale(
  row
){

  const activeMonths =
    activeAverageMonths();


  if(
    !activeMonths.length
  ){

    return 0;

  }


  let total = 0;

  let count = 0;


  for(
    const month of activeMonths
  ){

    const column =
      monthAmountColumn(
        month
      );


    if(
      column
    ){

      total +=
        Number(
          row[column]
          ||
          0
        );


      count++;

    }

  }


  return count

    ? total / count

    : 0;

}



/* =========================================
   EFFECTIVE FILTER OBJECT
========================================= */

function effectiveFilterObject(){

  const obj = {};


  for(
    const column of filters
  ){

    if(
      selected[column].length
    ){

      obj[column] =
        [...selected[column]];

    }

  }



  /*
    OD Logic

    budget_customer Order
          ↓
       Party list
          ↓
    products Party
  */

  if(
    selected.budgetOD.length
  ){

    let parties =
      odParties.map(
        String
      );



    /*
      Manual Party filter હોય
      તો Party + OD intersection.
    */

    if(
      selected.Party.length
    ){

      const allowed =
        new Set(
          parties
        );


      parties =
        selected.Party.filter(
          party =>
            allowed.has(
              String(
                party
              )
            )
        );

    }



    /*
      OD selected but no Party match હોય
      તો grand total ન આવવો જોઈએ.
    */

    obj.Party =

      parties.length

        ? parties

        : [
            '__RAJ_NO_MATCHING_PARTY__'
          ];

  }


  return obj;

}



/* =========================================
   FILTER OPTIONS OBJECT

   Current filter's own selection remove થાય
   જેથી same searchમાંથી multiple selection
   ચાલુ રાખી શકાય.
========================================= */

function filterObjectForOptions(
  column
){

  const obj =
    effectiveFilterObject();



  if(
    column !== 'Party'
  ){

    delete obj[column];

  }
  else if(
    selected.budgetOD.length
  ){

    obj.Party =

      odParties.length

        ? [...odParties]

        : [
            '__RAJ_NO_MATCHING_PARTY__'
          ];

  }
  else{

    delete obj.Party;

  }


  return obj;

}



/* =========================================
   MAIN DASHBOARD ARGUMENTS
========================================= */

const args =
  () => ({


    p_filters:
      effectiveFilterObject(),


    p_months:
      selected.month,


    p_sale_status:

      el(
        'productSaleStatus'
      )

        ? el(
            'productSaleStatus'
          ).value

        : 'All',


    p_search:

      el(
        'search'
      )

        ? el(
            'search'
          ).value.trim()

        : ''


  });



/* =========================================
   FILTER VALUE ARGUMENTS
========================================= */

const filterArgs =
  column => ({


    p_filters:
      filterObjectForOptions(
        column
      ),


    p_months:
      selected.month,


    p_sale_status:

      el(
        'productSaleStatus'
      )

        ? el(
            'productSaleStatus'
          ).value

        : 'All',


    p_search:

      el(
        'search'
      )

        ? el(
            'search'
          ).value.trim()

        : ''


  });



/* =========================================
   BUDGET REPORT ARGUMENTS
========================================= */

const budgetArgs =
  () => ({


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

      el(
        'budgetTarget'
      )

        ? el(
            'budgetTarget'
          ).value

        : 'all',


    p_status:

      el(
        'budgetStatus'
      )

        ? el(
            'budgetStatus'
          ).value

        : 'all',


    p_months:

      selected.month.length

        ? selected.month

        : null


  });



/* =========================================
   BUDGET MONTH SUMMARY ARGUMENTS
========================================= */

const budgetSummaryArgs =
  () => ({


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

      el(
        'budgetTarget'
      )

        ? el(
            'budgetTarget'
          ).value

        : 'all'


  });



/* =========================================
   SELECT ALL / UNSELECT ALL BUTTONS
========================================= */

function bulkButtons(
  id
){

  return `

    <div
      style="
        display:flex;
        gap:8px;
        padding:8px 6px 10px;
        border-bottom:1px solid #e5e7eb;
        position:sticky;
        top:0;
        background:#fff;
        z-index:5;
      "
    >


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



/* =========================================
   BUILD DYNAMIC FILTER UI
========================================= */

function buildFilterUI(){

  const grid =
    el(
      'filterGrid'
    );


  if(
    !grid
  ){

    return;

  }


  grid.innerHTML =

    filterDefs

      .map(
        (
          [
            id,
            label,
            allText
          ]
        ) => `


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


                <span
                  id="label_${id}"
                >
                  ${allText}
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



/* =========================================
   UPDATE NORMAL FILTER LABEL
========================================= */

function updateMultiLabel(
  column
){

  const definition =
    filterDefs.find(
      x =>
        x[0] === column
    );


  const label =
    el(
      'label_' + column
    );


  const chips =
    el(
      'chips_' + column
    );


  if(
    label
  ){

    label.textContent =

      selected[column].length

        ? `${selected[column].length} selected`

        : definition[2];

  }


  if(
    chips
  ){

    chips.innerHTML =

      selected[column]

        .slice(
          0,
          4
        )

        .map(
          value =>
            `<span class="chip">
              ${esc(
                value
              )}
            </span>`
        )

        .join('')


      +


      (
        selected[column].length > 4

          ? `<span class="chip">
              +${selected[column].length - 4}
            </span>`

          : ''
      );

  }

}



/* =========================================
   UPDATE MONTH LABEL
========================================= */

function updateMonthLabel(){

  const label =
    el(
      'label_month'
    );


  const chips =
    el(
      'chips_month'
    );


  if(
    label
  ){

    label.textContent =

      selected.month.length

        ? `${selected.month.length} selected`

        : 'All Months / Total';

  }


  if(
    chips
  ){

    chips.innerHTML =

      selected.month

        .map(
          month =>
            `<span class="chip">
              ${esc(
                monthNames[month]
                ||
                month
              )}
            </span>`
        )

        .join('');

  }

}



/* =========================================
   UPDATE OD LABEL
========================================= */

function updateODLabel(){

  const label =
    el(
      'label_budgetOD'
    );


  const chips =
    el(
      'chips_budgetOD'
    );


  if(
    label
  ){

    label.textContent =

      selected.budgetOD.length

        ? `${selected.budgetOD.length} selected`

        : 'All OD';

  }


  if(
    chips
  ){

    chips.innerHTML =

      selected.budgetOD

        .slice(
          0,
          4
        )

        .map(
          value =>
            `<span class="chip">
              ${esc(
                value
              )}
            </span>`
        )

        .join('')


      +


      (
        selected.budgetOD.length > 4

          ? `<span class="chip">
              +${selected.budgetOD.length - 4}
            </span>`

          : ''
      );

  }

}



/* =========================================
   OPTION VALUES
========================================= */

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
          .closest(
            '.multi-option'
          )
          ?.style
          .display
          !==
          'none'
    )

    .map(
      checkbox =>
        checkbox.value
    );

}



/* =========================================
   STABLE SEARCH
========================================= */

function applySearchFilter(
  id
){

  const search =
    el(
      'search_' + id
    );


  if(
    !search
  ){

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

          optionText.includes(
            text
          )

            ? 'flex'

            : 'none';

      }
    );

}



/* =========================================
   KEEP FILTER OPEN
========================================= */

function restoreOpenFilter(
  id
){

  const search =
    el(
      'search_' + id
    );


  const multi =
    el(
      'multi_' + id
    );


  if(
    search
  ){

    search.value =
      searchState[id]
      ||
      '';

  }


  applySearchFilter(
    id
  );


  if(
    multi
  ){

    multi.classList.add(
      'open'
    );

  }


  if(
    search
  ){

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

        }
        catch(
          _
        ){}

      }
    );

  }

}



/* =========================================
   SEARCH BOX EVENT
========================================= */

function wireSearchBox(
  id
){

  const search =
    el(
      'search_' + id
    );


  if(
    !search
  ){

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


      applySearchFilter(
        id
      );

    };

}



/* =========================================
   SELECT / UNSELECT ALL
========================================= */

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



  /* MONTH */

  if(
    id === 'month'
  ){

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
        checkbox => {


          if(
            !visibleOnly

            ||

            checkbox
              .closest(
                '.multi-option'
              )
              ?.style
              .display
              !==
              'none'
          ){

            checkbox.checked =
              selectAll;

          }

        }
      );


    updateMonthLabel();


    page = 1;

    budgetPage = 1;


    await loadDashboard(
      true
    );


    restoreOpenFilter(
      'month'
    );


    return;

  }



  /* OD */

  if(
    id === 'budgetOD'
  ){

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
        checkbox => {


          if(
            !visibleOnly

            ||

            checkbox
              .closest(
                '.multi-option'
              )
              ?.style
              .display
              !==
              'none'
          ){

            checkbox.checked =
              selectAll;

          }

        }
      );


    updateODLabel();


    await refreshODPartyScope();


    page = 1;

    budgetPage = 1;


    await loadDashboard(
      true
    );


    restoreOpenFilter(
      'budgetOD'
    );


    return;

  }



  /* NORMAL FILTER */

  if(
    !filters.includes(
      id
    )
  ){

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
      checkbox => {


        if(
          !visibleOnly

          ||

          checkbox
            .closest(
              '.multi-option'
            )
            ?.style
            .display
            !==
            'none'
        ){

          checkbox.checked =
            selectAll;

        }

      }
    );


  updateMultiLabel(
    id
  );


  page = 1;

  budgetPage = 1;


  await loadDashboard(
    true
  );


  restoreOpenFilter(
    id
  );

}



/* =========================================
   BUILD MONTH FILTER
========================================= */

function buildMonths(){

  const box =
    el(
      'options_month'
    );


  if(
    !box
  ){

    return;

  }


  box.innerHTML =

    bulkButtons(
      'month'
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
              )
                .toLowerCase()
            )}"
          >


            <input
              type="checkbox"
              value="${esc(
                month
              )}"
              ${
                selected.month.includes(
                  String(
                    month
                  )
                )

                  ? 'checked'

                  : ''
              }
            >


            <span>
              ${esc(
                monthNames[month]
                ||
                month
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


            if(
              checkbox.checked
            ){

              if(
                !selected.month.includes(
                  checkbox.value
                )
              ){

                selected.month.push(
                  checkbox.value
                );

              }

            }
            else{

              selected.month =

                selected.month.filter(
                  month =>
                    month !==
                    checkbox.value
                );

            }


            updateMonthLabel();


            page = 1;

            budgetPage = 1;


            await loadDashboard(
              true
            );


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



/* =========================================
   LOAD NORMAL FILTER OPTIONS
========================================= */

async function loadFilter(
  column
){

  const data =

    await rpc(
      'raj_filter_values',
      {

        p_column:
          column,

        ...filterArgs(
          column
        )

      }
    );


  const box =
    el(
      'options_' + column
    );


  if(
    !box
  ){

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

                Object.values(
                  value
                )[0]
              )

            : value
      );



  /*
    Current selected values પણ preserve થાય.
  */

  const values =

    [
      ...new Set(
        [

          ...rawValues.map(
            value =>
              String(
                value ?? ''
              )
          ),

          ...selected[column]

        ]
      )
    ]

      .filter(
        Boolean
      );



  box.innerHTML =

    bulkButtons(
      column
    )


    +


    values

      .map(
        value => `


          <label
            class="multi-option"
            data-text="${esc(
              String(
                value
              )
                .toLowerCase()
            )}"
          >


            <input
              type="checkbox"
              value="${esc(
                value
              )}"
              ${
                selected[column].includes(
                  String(
                    value
                  )
                )

                  ? 'checked'

                  : ''
              }
            >


            <span>
              ${esc(
                value
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


            if(
              checkbox.checked
            ){

              if(
                !selected[column].includes(
                  checkbox.value
                )
              ){

                selected[column].push(
                  checkbox.value
                );

              }

            }
            else{

              selected[column] =

                selected[column].filter(
                  value =>
                    value !==
                    checkbox.value
                );

            }


            updateMultiLabel(
              column
            );


            page = 1;

            budgetPage = 1;


            await loadDashboard(
              true
            );


            /*
              Search text + dropdown
              બંને stable રહે.
            */

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



/* =========================================
   REFRESH ALL FILTERS
========================================= */

async function refreshFilters(){

  for(
    const column of filters
  ){

    await loadFilter(
      column
    );

  }

}



/* =========================================
   LOAD OD OPTIONS
========================================= */

async function loadODOptions(){

  const box =
    el(
      'options_budgetOD'
    );


  if(
    !box
  ){

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

      .filter(
        Boolean
      );


  box.innerHTML =

    bulkButtons(
      'budgetOD'
    )


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
              value="${esc(
                value
              )}"
              ${
                selected.budgetOD.includes(
                  value
                )

                  ? 'checked'

                  : ''
              }
            >


            <span>
              ${esc(
                value
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


            if(
              checkbox.checked
            ){

              if(
                !selected.budgetOD.includes(
                  checkbox.value
                )
              ){

                selected.budgetOD.push(
                  checkbox.value
                );

              }

            }
            else{

              selected.budgetOD =

                selected.budgetOD.filter(
                  value =>
                    value !==
                    checkbox.value
                );

            }


            updateODLabel();


            await refreshODPartyScope();


            page = 1;

            budgetPage = 1;


            await loadDashboard(
              true
            );


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



/* =========================================
   OD PARTY SCOPE
========================================= */

async function refreshODPartyScope(){

  if(
    !selected.budgetOD.length
  ){

    odParties = [];

    return;

  }


  const data =

    await rpc(
      'raj_budget_od_parties',
      {

        p_ods:
          selected.budgetOD

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

      .filter(
        Boolean
      );

}



/* =========================================
   BUDGET MONTH SUMMARY
========================================= */

async function loadBudgetMonthSummary(){

  try{


    const data =

      await rpc(
        'raj_budget_month_summary',
        budgetSummaryArgs()
      );


    budgetMonthStats =
      {};


    for(
      const row of (
        data || []
      )
    ){


      const month =

        row.Month

        ??

        row.month;



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

  }
  catch(
    error
  ){

    console.error(
      'Budget month summary error:',
      error
    );


    budgetMonthStats =
      {};

  }

}



/* =========================================
   GET BUDGET MONTH STATS
========================================= */

function budgetStatsForMonth(
  month
){

  return

    budgetMonthStats[month]


    ||


    budgetMonthStats[
      normalizeMonth(
        month
      )
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


    {};

}



/* =========================================
   MONTH SUMMARY CARDS
========================================= */

function renderMonths(
  monthData
){

  const container =
    el(
      'monthlyCards'
    );


  if(
    !container
  ){

    return;

  }



  /*
    Average Monthly Sale

    Month selected હોય:
    selected months avg

    Month select ન હોય:
    all available months avg
  */

  const averageMonths =
    activeAverageMonths();



  const averageTotal =

    averageMonths.reduce(
      (
        total,
        month
      ) =>

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

                <span>
                  Qty
                </span>

                <b>
                  ${fmt(
                    sales.Qty
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Taxable
                </span>

                <b>
                  ${money(
                    sales.Taxable
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Sale
                </span>

                <b>
                  ${money(
                    sales.Sale
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Products Sold
                </span>

                <b>
                  ${fmt(
                    sales.ProductsSold
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Customers Billed
                </span>

                <b>
                  ${fmt(
                    sales.CustomersBilled
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Budget Customers
                </span>

                <b>
                  ${fmt(
                    budget.BudgetCustomers
                    ||
                    0
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Sales Customers
                </span>

                <b>
                  ${fmt(
                    budget.SalesCustomers
                    ||
                    0
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Zero Sales Customers
                </span>

                <b>
                  ${fmt(
                    budget.ZeroSalesCustomers
                    ||
                    0
                  )}
                </b>

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



/* =========================================
   DETAIL TABLE
========================================= */

function renderRows(
  rows
){

  const body =
    el(
      'tableBody'
    );


  if(
    !body
  ){

    return;

  }


  if(
    !rows?.length
  ){

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
                            .test(
                              column
                            )

                            ? fmt(
                                value
                              )

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
                rowAverageSale(
                  row
                )
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



/* =========================================
   ANALYSIS VIEW
========================================= */

async function loadGroupSummary(){

  const body =
    el(
      'groupSummaryBody'
    );


  if(
    !body
  ){

    return;

  }


  const headRow =

    body
      .closest(
        'table'
      )
      ?.querySelector(
        'thead tr'
      );


  if(
    !headRow
  ){

    return;

  }



  const analysisMonths =
    activeAverageMonths();



  try{


    const results =

      await Promise.all(
        [


          /*
            Main selected scope.
          */

          rpc(
            'raj_group_summary',
            {

              p_view:
                currentView,

              ...args()

            }
          ),



          /*
            Each month separately.
          */

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
      results.slice(
        1
      );



    const viewName =

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

      })[
        currentView
      ]

      ||

      currentView;



    let header = `

      <th id="viewLabel">
        ${esc(
          viewName
        )}
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
            )}
            Sale
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



    if(
      !totalData.length
    ){

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


          (
            rows || []
          )

            .forEach(
              row =>

                map.set(
                  String(
                    row.label
                  ),
                  Number(
                    row.sale
                    ||
                    0
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
                (
                  month,
                  index
                ) =>

                  monthMaps[index]
                    ?.get(
                      String(
                        row.label
                      )
                    )

                  ||

                  0
              );



            const averageSale =

              monthSales.length

                ? monthSales.reduce(
                    (
                      total,
                      sale
                    ) =>
                      total + sale,

                    0
                  )
                  /
                  monthSales.length

                : 0;



            const monthCells =

              monthSales

                .map(
                  sale => `

                    <td>
                      ${money(
                        sale
                      )}
                    </td>

                  `
                )

                .join('');



            return `


              <tr>


                <td>
                  ${esc(
                    row.label
                  )}
                </td>


                ${monthCells}


                <td>
                  ${money(
                    averageSale
                  )}
                </td>


                <td>
                  ${fmt(
                    row.qty
                  )}
                </td>


                <td>
                  ${money(
                    row.taxable
                  )}
                </td>


                <td>
                  ${money(
                    row.sale
                  )}
                </td>


                <td>
                  ${fmt(
                    row.productsSold
                  )}
                </td>


                <td>
                  ${fmt(
                    row.customersBilled
                  )}
                </td>


                <td>
                  ${fmt(
                    row.records
                  )}
                </td>


              </tr>


            `;

          }
        )

        .join('');


  }
  catch(
    error
  ){

    console.error(
      'Analysis View Error:',
      error
    );


    body.innerHTML = `


      <tr>

        <td class="empty">

          Analysis error:
          ${esc(
            error.message
          )}

        </td>

      </tr>


    `;

  }

}



/* =========================================
   SALES COMPARISON

   Top Month Filter ONLY

   Example:

   Apr + May + June + July

   Compare:
   Apr + May + June

   Actual:
   July
========================================= */

async function loadComparison(){

  const setText =
    (
      id,
      value
    ) => {


      const node =
        el(
          id
        );


      if(
        node
      ){

        node.textContent =
          value;

      }

    };



  const status =
    el(
      'compareStatus'
    );



  /*
    Minimum 2 months required.
  */

  if(
    selected.month.length < 2
  ){

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
      money(
        0
      )
    );


    setText(
      'compareActualSale',
      money(
        0
      )
    );


    setText(
      'compareDifference',
      money(
        0
      )
    );


    setText(
      'comparePercent',
      '0%'
    );


    if(
      status
    ){

      status.textContent =
        'Select at least 2 months';


      status.className =
        'compare-status compare-neutral';

    }


    return;

  }



  /*
    Schema month order follow થાય.

    User checkbox કયા orderમાં select કરે
    એ matter નહીં કરે.

    Example:
    months = Apr May June July Aug Sept

    selected = July, Apr, June

    ordered becomes:
    Apr, June, July

    Actual = July
  */

  const orderedSelected =

    months.filter(
      month =>
        selected.month.includes(
          month
        )
    );



  if(
    orderedSelected.length < 2
  ){

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

      .join(
        ' + '
      )

  );



  setText(

    'compareActualMonth',

    monthNames[actualMonth]

    ||

    actualMonth

  );



  try{


    /*
      Same dashboard filters.

      માત્ર p_months overwrite થાય છે.
    */

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
            result?.summary?.TotalSale
            ||
            0
          )
      );



    const compareTotal =

      compareSales.reduce(
        (
          total,
          sale
        ) =>
          total + sale,

        0
      );



    const compareAverage =

      compareSales.length

        ? compareTotal
          /
          compareSales.length

        : 0;



    const actualSale =

      Number(
        actualResult?.summary?.TotalSale
        ||
        0
      );



    const difference =

      actualSale

      -

      compareAverage;



    const percentage =

      compareAverage !== 0

        ? (
            difference
            /
            compareAverage
          )
          *
          100

        : 0;



    setText(
      'compareAvgSale',
      money(
        compareAverage
      )
    );



    setText(
      'compareActualSale',
      money(
        actualSale
      )
    );



    setText(

      'compareDifference',

      (
        difference > 0

          ? '+'

          : ''
      )

      +

      money(
        difference
      )

    );



    setText(

      'comparePercent',

      (
        percentage > 0

          ? '+'

          : ''
      )

      +

      fmt(
        percentage
      )

      +

      '%'

    );



    if(
      status
    ){


      if(
        difference > 0
      ){

        status.textContent =
          'Above Avg';


        status.className =
          'compare-status compare-positive';

      }
      else if(
        difference < 0
      ){

        status.textContent =
          'Below Avg';


        status.className =
          'compare-status compare-negative';

      }
      else{

        status.textContent =
          'Equal to Avg';


        status.className =
          'compare-status compare-neutral';

      }

    }


  }
  catch(
    error
  ){

    console.error(
      'Comparison error:',
      error
    );


    if(
      status
    ){

      status.textContent =
        'Comparison error';


      status.className =
        'compare-status compare-negative';

    }

  }

}



/* =========================================
   BUDGET MONTHS TO DISPLAY
========================================= */

function budgetMonthsToShow(){

  const chosenMonths =

    selected.month.length

      ? selected.month

      : months;


  const normalized =
    [];


  for(
    const month of chosenMonths
  ){

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

      !normalized.includes(
        key
      )
    ){

      normalized.push(
        key
      );

    }

  }


  return normalized;

}



/* =========================================
   DIFFERENCE CLASS
========================================= */

function diffClass(
  value
){

  return Number(
    value
    ||
    0
  ) < 0

    ? 'budget-negative'

    : 'budget-positive';

}



/* =========================================
   RENDER BUDGET
========================================= */

function renderBudget(){

  const panel =
    el(
      'budgetPanel'
    );


  if(
    !panel
  ){

    return;

  }



  /*
    Customer budget Company/Product
    analysisમાં hide.
  */

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

        `<th>
          ${name} Sales
        </th>`

        +

        `<th>
          ${name} Budget
        </th>`

        +

        `<th>
          ${name} Diff
        </th>`;

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



  if(
    el(
      'budgetTableHead'
    )
  ){

    el(
      'budgetTableHead'
    ).innerHTML =
      head;

  }



  if(
    el(
      'budgetCount'
    )
  ){

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
    el(
      'budgetTableBody'
    );


  if(
    !body
  ){

    return;

  }



  if(
    !rows.length
  ){

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

  }
  else{


    body.innerHTML =

      rows

        .map(
          row => {


            let cells =


              `<td>
                ${esc(
                  row.SalesMan
                  ||
                  ''
                )}
              </td>`


              +


              `<td>
                ${esc(
                  row.Party
                  ||
                  ''
                )}
              </td>`


              +


              `<td>
                ${esc(
                  row.Target
                  ||
                  ''
                )}
              </td>`


              +


              `<td>
                ${esc(
                  row.Order
                  ||
                  ''
                )}
              </td>`;



            showMonths.forEach(
              month => {


                const [
                  budgetKey,
                  salesKey,
                  diffKey
                ] =
                  budgetMonthMap[
                    month
                  ];



                cells +=


                  `<td>
                    ${money(
                      row[salesKey]
                    )}
                  </td>`


                  +


                  `<td>
                    ${money(
                      row[budgetKey]
                    )}
                  </td>`


                  +


                  `<td
                    class="${
                      diffClass(
                        row[diffKey]
                      )
                    }"
                  >
                    ${money(
                      row[diffKey]
                    )}
                  </td>`;

              }
            );



            if(
              multiSelected

              ||

              !selected.month.length
            ){

              cells +=


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


                `<td
                  class="${
                    diffClass(
                      row.Difference
                    )
                  }"
                >
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

                  <span
                    class="budget-status ${
                      row.BudgetStatus === 'ACHIEVED'

                        ? 'ok'

                        : 'bad'
                    }"
                  >
                    ${esc(
                      row.BudgetStatus
                      ||
                      ''
                    )}
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



  if(
    el(
      'budgetPageInfo'
    )
  ){

    el(
      'budgetPageInfo'
    ).textContent =

      `Page ${budgetPage} of ${totalBudgetPages} • ${fmt(
        budgetRows.length
      )} customers`;

  }



  if(
    el(
      'budgetPrev'
    )
  ){

    el(
      'budgetPrev'
    ).disabled =
      budgetPage <= 1;

  }



  if(
    el(
      'budgetNext'
    )
  ){

    el(
      'budgetNext'
    ).disabled =
      budgetPage >= totalBudgetPages;

  }



  if(
    el(
      'budgetNote'
    )
  ){

    el(
      'budgetNote'
    ).textContent =

      selected.month.length

        ? `Showing ${
            selected.month

              .map(
                month =>
                  monthNames[month]
                  ||
                  month
              )

              .join(
                ', '
              )
          } budget vs actual sales.`

        : 'No month selected: showing all available months side-by-side.';

  }

}



/* =========================================
   LOAD BUDGET
========================================= */

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
    el(
      'budgetLoading'
    );


  if(
    loading
  ){

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


  }
  catch(
    error
  ){

    console.error(
      error
    );


    const body =
      el(
        'budgetTableBody'
      );


    if(
      body
    ){

      body.innerHTML = `


        <tr>

          <td class="empty">

            Budget error:
            ${esc(
              error.message
            )}

          </td>

        </tr>


      `;

    }

  }
  finally{


    if(
      loading
    ){

      loading.classList.remove(
        'show'
      );

    }

  }

}



/* =========================================
   LOAD MAIN DASHBOARD
========================================= */

async function loadDashboard(
  reloadFilters = false
){

  const loading =
    el(
      'loading'
    );


  if(
    loading
  ){

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

                  el(
                    'pageSize'
                  )

                    ? el(
                        'pageSize'
                      ).value

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



    /* TOP CARDS */

    if(
      el(
        'totalQty'
      )
    ){

      el(
        'totalQty'
      ).textContent =
        fmt(
          summary.TotalQty
        );

    }



    if(
      el(
        'totalTaxable'
      )
    ){

      el(
        'totalTaxable'
      ).textContent =
        money(
          summary.TotalTaxable
        );

    }



    if(
      el(
        'totalSale'
      )
    ){

      el(
        'totalSale'
      ).textContent =
        money(
          summary.TotalSale
        );

    }



    if(
      el(
        'productsSold'
      )
    ){

      el(
        'productsSold'
      ).textContent =
        fmt(
          summary.ProductsSold
        );

    }



    if(
      el(
        'customersBilled'
      )
    ){

      el(
        'customersBilled'
      ).textContent =
        fmt(
          summary.CustomersBilled
        );

    }



    if(
      el(
        'recordCount'
      )
    ){

      el(
        'recordCount'
      ).textContent =
        fmt(
          rowsResult?.totalRows
        );

    }



    /* PAGINATION */

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



    if(
      el(
        'pageInfo'
      )
    ){

      el(
        'pageInfo'
      ).textContent =

        `Page ${page} of ${totalPages} • ${fmt(
          rowsResult?.totalRows
        )} records`;

    }



    if(
      el(
        'prevPage'
      )
    ){

      el(
        'prevPage'
      ).disabled =
        page <= 1;

    }



    if(
      el(
        'nextPage'
      )
    ){

      el(
        'nextPage'
      ).disabled =
        page >= totalPages;

    }



    /*
      Month budget customer counts
    */

    await loadBudgetMonthSummary();



    /*
      Month summary cards
    */

    renderMonths(
      summaryResult?.monthly
      ||
      {}
    );



    /*
      Detailed rows
    */

    renderRows(
      rowsResult?.rows
      ||
      []
    );



    /*
      Refresh dependent filters.
    */

    if(
      reloadFilters
    ){

      await refreshFilters();


      buildMonths();


      await loadODOptions();

    }



    /*
      Analysis + Budget + Comparison
    */

    await Promise.all(
      [

        loadGroupSummary(),

        loadBudget(),

        loadComparison()

      ]
    );


  }
  catch(
    error
  ){

    console.error(
      error
    );


    alert(
      'Dashboard error: '
      +
      error.message
    );

  }
  finally{


    if(
      loading
    ){

      loading.classList.remove(
        'show'
      );

    }

  }

}



/* =========================================
   STARTUP
========================================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {


    try{


      buildFilterUI();



      /* GET SCHEMA */

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



      /* DETAIL TABLE HEADER */

      const tableHead =
        el(
          'tableHead'
        );


      if(
        tableHead
      ){

        tableHead.innerHTML =

          columns

            .map(
              column =>
                `<th>
                  ${esc(
                    column
                  )}
                </th>`
            )

            .join('')


          +


          '<th>Avg Sales</th>';

      }



      buildMonths();



      /* ===================================
         GLOBAL CLICK HANDLER
      =================================== */

      document.addEventListener(
        'click',
        event => {


          /* SELECT ALL */

          const selectAllButton =

            event.target.closest(
              '[data-select-all]'
            );


          if(
            selectAllButton
          ){

            event.preventDefault();

            event.stopPropagation();


            applyBulkSelection(

              selectAllButton
                .dataset
                .selectAll,

              true

            );


            return;

          }



          /* UNSELECT ALL */

          const unselectAllButton =

            event.target.closest(
              '[data-unselect-all]'
            );


          if(
            unselectAllButton
          ){

            event.preventDefault();

            event.stopPropagation();


            applyBulkSelection(

              unselectAllButton
                .dataset
                .unselectAll,

              false

            );


            return;

          }



          /* OPEN MULTI SELECT */

          const openButton =

            event.target.closest(
              '[data-open]'
            );


          if(
            openButton
          ){

            const id =
              openButton.dataset.open;


            const multi =
              el(
                'multi_' + id
              );


            if(
              !multi
            ){

              return;

            }



            document

              .querySelectorAll(
                '.multi.open'
              )

              .forEach(
                item => {


                  if(
                    item !== multi
                  ){

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


              if(
                search
              ){

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



          /*
            Outside click closes dropdown.
          */

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



      /* ===================================
         SEARCH BOX EVENTS
      =================================== */

      for(
        const [
          id
        ] of filterDefs
      ){

        wireSearchBox(
          id
        );

      }


      wireSearchBox(
        'month'
      );


      wireSearchBox(
        'budgetOD'
      );



      /* ===================================
         INITIAL DATA
      =================================== */

      await refreshFilters();


      await loadODOptions();


      await loadDashboard();



      /* ===================================
         PRODUCT SALE STATUS
      =================================== */

      const productSaleStatus =
        el(
          'productSaleStatus'
        );


      if(
        productSaleStatus
      ){

        productSaleStatus.onchange =
          async () => {


            page = 1;


            await loadDashboard(
              true
            );

          };

      }



      /* ===================================
         BUDGET STATUS
      =================================== */

      const budgetStatus =
        el(
          'budgetStatus'
        );


      if(
        budgetStatus
      ){

        budgetStatus.onchange =
          async () => {


            budgetPage = 1;


            await loadBudget();

          };

      }



      /* ===================================
         BUDGET TARGET
      =================================== */

      const budgetTarget =
        el(
          'budgetTarget'
        );


      if(
        budgetTarget
      ){

        budgetTarget.onchange =
          async () => {


            budgetPage = 1;


            /*
              Month Summary budget customers
              પણ target mode respect કરે.
            */

            await loadDashboard(
              false
            );

          };

      }



      /* ===================================
         GLOBAL SEARCH
      =================================== */

      const globalSearch =
        el(
          'search'
        );


      if(
        globalSearch
      ){

        globalSearch.oninput =
          () => {


            clearTimeout(
              timer
            );


            timer =

              setTimeout(

                async () => {


                  page = 1;


                  await loadDashboard(
                    true
                  );


                },

                350

              );

          };

      }



      /* ===================================
         PAGE SIZE
      =================================== */

      const pageSize =
        el(
          'pageSize'
        );


      if(
        pageSize
      ){

        pageSize.onchange =
          async () => {


            page = 1;


            await loadDashboard();

          };

      }



      /* ===================================
         DETAIL PREVIOUS
      =================================== */

      const prevPage =
        el(
          'prevPage'
        );


      if(
        prevPage
      ){

        prevPage.onclick =
          async () => {


            if(
              page > 1
            ){

              page--;


              await loadDashboard();

            }

          };

      }



      /* ===================================
         DETAIL NEXT
      =================================== */

      const nextPage =
        el(
          'nextPage'
        );


      if(
        nextPage
      ){

        nextPage.onclick =
          async () => {


            if(
              page < totalPages
            ){

              page++;


              await loadDashboard();

            }

          };

      }



      /* ===================================
         BUDGET PREVIOUS
      =================================== */

      const budgetPrev =
        el(
          'budgetPrev'
        );


      if(
        budgetPrev
      ){

        budgetPrev.onclick =
          () => {


            if(
              budgetPage > 1
            ){

              budgetPage--;


              renderBudget();

            }

          };

      }



      /* ===================================
         BUDGET NEXT
      =================================== */

      const budgetNext =
        el(
          'budgetNext'
        );


      if(
        budgetNext
      ){

        budgetNext.onclick =
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


            if(
              budgetPage < pages
            ){

              budgetPage++;


              renderBudget();

            }

          };

      }



      /* ===================================
         CLEAR ALL FILTERS
      =================================== */

      const clearFilters =
        el(
          'clearFilters'
        );


      if(
        clearFilters
      ){

        clearFilters.onclick =
          async () => {


            /*
              Global search
            */

            if(
              el(
                'search'
              )
            ){

              el(
                'search'
              ).value =
                '';

            }



            /*
              Month
            */

            selected.month =
              [];



            /*
              OD
            */

            selected.budgetOD =
              [];


            odParties =
              [];



            /*
              Search states
            */

            Object

              .keys(
                searchState
              )

              .forEach(
                key =>
                  searchState[key] =
                    ''
              );



            /*
              Product status
            */

            if(
              el(
                'productSaleStatus'
              )
            ){

              el(
                'productSaleStatus'
              ).value =
                'All';

            }



            /*
              Budget status
            */

            if(
              el(
                'budgetStatus'
              )
            ){

              el(
                'budgetStatus'
              ).value =
                'all';

            }



            /*
              Budget target
            */

            if(
              el(
                'budgetTarget'
              )
            ){

              el(
                'budgetTarget'
              ).value =
                'all';

            }



            /*
              Normal filters
            */

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


            updateODLabel();



            page = 1;

            budgetPage = 1;



            await loadDashboard(
              true
            );

          };

      }



      /* ===================================
         ANALYSIS TABS
      =================================== */

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


    }
    catch(
      error
    ){

      console.error(
        error
      );


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
