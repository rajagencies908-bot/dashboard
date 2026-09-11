const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);


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


const filters =
  filterDefs.map(
    x => x[0]
  );


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
selected.compareMonths = [];

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
   HELPERS
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
   RPC
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
  m
){

  if(
    m === 'Jun'
  ){

    return 'June';

  }


  if(
    m === 'Jul'
  ){

    return 'July';

  }


  if(
    m === 'Sep'
  ){

    return 'Sept';

  }


  return m;

}


function monthAmountColumn(
  month
){

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

  const ms =
    activeAverageMonths();


  if(
    !ms.length
  ){

    return 0;

  }


  let total = 0;
  let count = 0;


  for(
    const m of ms
  ){

    const c =
      monthAmountColumn(
        m
      );


    if(
      c
    ){

      total +=
        Number(
          row[c]
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
    const c of filters
  ){

    if(
      selected[c].length
    ){

      obj[c] =
        [...selected[c]];

    }

  }


  /*
    OD selected હોય તો
    OD customersની Party list
    products Party પર apply થશે.
  */

  if(
    selected.budgetOD.length
  ){

    let parties =
      odParties.map(
        String
      );


    /*
      Party filter manually selected હોય
      તો intersection.
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
          p =>
            allowed.has(
              String(p)
            )
        );

    }


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
   FILTER OPTION OBJECT

   Current column restriction remove થાય
   જેથી multiple same-search selections
   disappear ન થાય.
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
   MAIN DASHBOARD ARGS
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
   FILTER VALUE ARGS
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
   BUDGET REPORT ARGS
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
   MONTH BUDGET SUMMARY ARGS
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
   SELECT ALL BUTTONS
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
   BUILD FILTER UI
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
            all
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


/* =========================================
   NORMAL FILTER LABEL
========================================= */

function updateMultiLabel(
  column
){

  const def =
    filterDefs.find(
      x =>
        x[0] === column
    );


  if(
    el(
      'label_' + column
    )
  ){

    el(
      'label_' + column
    ).textContent =

      selected[column].length

        ? `${selected[column].length} selected`

        : def[2];

  }


  if(
    el(
      'chips_' + column
    )
  ){

    el(
      'chips_' + column
    ).innerHTML =

      selected[column]

        .slice(
          0,
          4
        )

        .map(
          v =>
            `<span class="chip">
              ${esc(v)}
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
   MONTH LABEL
========================================= */

function updateMonthLabel(){

  if(
    el(
      'label_month'
    )
  ){

    el(
      'label_month'
    ).textContent =

      selected.month.length

        ? `${selected.month.length} selected`

        : 'All Months / Total';

  }


  if(
    el(
      'chips_month'
    )
  ){

    el(
      'chips_month'
    ).innerHTML =

      selected.month

        .map(
          v =>
            `<span class="chip">
              ${esc(
                monthNames[v]
                ||
                v
              )}
            </span>`
        )

        .join('');

  }

}


/* =========================================
   OD LABEL
========================================= */

function updateODLabel(){

  if(
    el(
      'label_budgetOD'
    )
  ){

    el(
      'label_budgetOD'
    ).textContent =

      selected.budgetOD.length

        ? `${selected.budgetOD.length} selected`

        : 'All OD';

  }


  if(
    el(
      'chips_budgetOD'
    )
  ){

    el(
      'chips_budgetOD'
    ).innerHTML =

      selected.budgetOD

        .slice(
          0,
          4
        )

        .map(
          v =>
            `<span class="chip">
              ${esc(v)}
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
   COMPARE LABEL
========================================= */

function updateCompareLabel(){

  if(
    el(
      'label_compareMonths'
    )
  ){

    el(
      'label_compareMonths'
    ).textContent =

      selected.compareMonths.length

        ? `${selected.compareMonths.length} selected`

        : 'Select Compare Months';

  }


  if(
    el(
      'chips_compareMonths'
    )
  ){

    el(
      'chips_compareMonths'
    ).innerHTML =

      selected.compareMonths

        .map(
          v =>
            `<span class="chip">
              ${esc(
                monthNames[v]
                ||
                v
              )}
            </span>`
        )

        .join('');

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
      x =>

        !visibleOnly

        ||

        x
          .closest(
            '.multi-option'
          )
          ?.style
          .display
          !==
          'none'
    )

    .map(
      x =>
        x.value
    );

}


/* =========================================
   SEARCH FILTER
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

        const t =

          String(
            option.dataset.text
            ||
            ''
          )
            .toLowerCase();


        option.style.display =

          t.includes(
            text
          )

            ? 'flex'

            : 'none';

      }
    );

}


/* =========================================
   KEEP DROPDOWN OPEN
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

        const len =
          search.value.length;


        try{

          search.setSelectionRange(
            len,
            len
          );

        }
        catch(_){}

      }
    );

  }

}


/* =========================================
   SEARCH INPUT
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

  if(
    id === 'compareMonths'
  ){

    selected.compareMonths =

      selectAll

        ? valuesFromOptions(
            'compareMonths'
          )

        : [];


    document

      .querySelectorAll(
        '#options_compareMonths input[type="checkbox"]'
      )

      .forEach(
        x =>
          x.checked =
            selectAll
      );


    updateCompareLabel();


    await loadComparison();


    return;

  }


  const visibleOnly =

    Boolean(
      (
        searchState[id]
        ||
        ''
      ).trim()
    );


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
        x => {

          if(
            !visibleOnly
            ||
            x
              .closest(
                '.multi-option'
              )
              ?.style
              .display
              !==
              'none'
          ){

            x.checked =
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
        x => {

          if(
            !visibleOnly
            ||
            x
              .closest(
                '.multi-option'
              )
              ?.style
              .display
              !==
              'none'
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


    await loadDashboard(
      true
    );


    restoreOpenFilter(
      'budgetOD'
    );


    return;

  }


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
      x => {

        if(
          !visibleOnly
          ||
          x
            .closest(
              '.multi-option'
            )
            ?.style
            .display
            !==
            'none'
        ){

          x.checked =
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
        m => `

          <label
            class="multi-option"
            data-text="${esc(
              (
                monthNames[m]
                ||
                m
              )
                .toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(m)}"
              ${
                selected.month
                  .includes(
                    String(m)
                  )

                  ? 'checked'

                  : ''
              }
            >

            <span>
              ${esc(
                monthNames[m]
                ||
                m
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
      cb => {

        cb.onchange =
          async () => {

            if(
              cb.checked
            ){

              if(
                !selected.month
                  .includes(
                    cb.value
                  )
              ){

                selected.month.push(
                  cb.value
                );

              }

            }
            else{

              selected.month =

                selected.month.filter(
                  x =>
                    x !==
                    cb.value
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
   BUILD COMPARISON CONTROL
========================================= */

function buildComparisonControls(){

  const box =
    el(
      'options_compareMonths'
    );


  const actual =
    el(
      'actualCompareMonth'
    );


  if(
    box
  ){

    box.innerHTML =

      bulkButtons(
        'compareMonths'
      )

      +

      months

        .map(
          m => `

            <label
              class="multi-option"
              data-text="${esc(
                (
                  monthNames[m]
                  ||
                  m
                )
                  .toLowerCase()
              )}"
            >

              <input
                type="checkbox"
                value="${esc(m)}"
                ${
                  selected.compareMonths
                    .includes(
                      String(m)
                    )

                    ? 'checked'

                    : ''
                }
              >

              <span>
                ${esc(
                  monthNames[m]
                  ||
                  m
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
        cb => {

          cb.onchange =
            async () => {

              if(
                cb.checked
              ){

                if(
                  !selected.compareMonths
                    .includes(
                      cb.value
                    )
                ){

                  selected.compareMonths.push(
                    cb.value
                  );

                }

              }
              else{

                selected.compareMonths =

                  selected.compareMonths.filter(
                    x =>
                      x !==
                      cb.value
                  );

              }


              updateCompareLabel();


              await loadComparison();

            };

        }
      );

  }


  if(
    actual
  ){

    const current =
      actual.value;


    actual.innerHTML =

      '<option value="">Select Actual Month</option>'

      +

      months

        .map(
          m =>
            `<option value="${esc(m)}">
              ${esc(
                monthNames[m]
                ||
                m
              )}
            </option>`
        )

        .join('');


    if(
      months.includes(
        current
      )
    ){

      actual.value =
        current;

    }

  }

}


/* =========================================
   LOAD FILTER VALUES
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


  const raw =

    (data || [])

      .map(
        v =>

          typeof v === 'object'
          &&
          v !== null

            ? (
                v.value
                ??
                v.Value
                ??
                Object.values(
                  v
                )[0]
              )

            : v
      );


  const values =

    [
      ...new Set(
        [

          ...raw.map(
            v =>
              String(
                v ?? ''
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
        v => `

          <label
            class="multi-option"
            data-text="${esc(
              String(v)
                .toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(v)}"
              ${
                selected[column]
                  .includes(
                    String(v)
                  )

                  ? 'checked'

                  : ''
              }
            >

            <span>
              ${esc(v)}
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
      cb => {

        cb.onchange =
          async () => {

            if(
              cb.checked
            ){

              if(
                !selected[column]
                  .includes(
                    cb.value
                  )
              ){

                selected[column].push(
                  cb.value
                );

              }

            }
            else{

              selected[column] =

                selected[column]
                  .filter(
                    v =>
                      v !==
                      cb.value
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
   REFRESH FILTERS
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
        r =>
          String(
            r.OD
            ??
            r.od
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
        v => `

          <label
            class="multi-option"
            data-text="${esc(
              v.toLowerCase()
            )}"
          >

            <input
              type="checkbox"
              value="${esc(v)}"
              ${
                selected.budgetOD
                  .includes(
                    v
                  )

                  ? 'checked'

                  : ''
              }
            >

            <span>
              ${esc(v)}
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
      cb => {

        cb.onchange =
          async () => {

            if(
              cb.checked
            ){

              if(
                !selected.budgetOD
                  .includes(
                    cb.value
                  )
              ){

                selected.budgetOD.push(
                  cb.value
                );

              }

            }
            else{

              selected.budgetOD =

                selected.budgetOD
                  .filter(
                    v =>
                      v !==
                      cb.value
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
   OD -> PARTY
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
        r =>
          String(
            r.Party
            ??
            r.party
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

      const m =
        row.Month
        ??
        row.month;


      budgetMonthStats[m] = {

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
    err
  ){

    console.error(
      'Budget month summary error:',
      err
    );


    budgetMonthStats =
      {};

  }

}


/* =========================================
   BUDGET MONTH STATS
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
   MONTH CARDS
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


  const avgMonths =
    activeAverageMonths();


  const avgTotal =

    avgMonths.reduce(
      (
        sum,
        m
      ) =>
        sum
        +
        Number(
          monthData?.[m]?.Sale
          ||
          0
        ),

      0
    );


  const avgSale =

    avgMonths.length

      ? avgTotal / avgMonths.length

      : 0;


  const avgCard = `

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
            avgMonths.length
          )}
        </b>

      </div>

      <div class="metric">

        <span>
          Avg Sales
        </span>

        <b>
          ${money(
            avgSale
          )}
        </b>

      </div>

    </div>

  `;


  const cards =

    months

      .map(
        month => {

          const a =
            monthData?.[month]
            ||
            {};


          const b =
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
                    a.Qty
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Taxable
                </span>

                <b>
                  ${money(
                    a.Taxable
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Sale
                </span>

                <b>
                  ${money(
                    a.Sale
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Products Sold
                </span>

                <b>
                  ${fmt(
                    a.ProductsSold
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Customers Billed
                </span>

                <b>
                  ${fmt(
                    a.CustomersBilled
                  )}
                </b>

              </div>


              <div class="metric">

                <span>
                  Budget Customers
                </span>

                <b>
                  ${fmt(
                    b.BudgetCustomers
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
                    b.ZeroSalesCustomers
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
    avgCard
    +
    cards;

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
        row =>

          '<tr>'

          +

          columns

            .map(
              column =>
                `<td>${
                  esc(

                    /Qty|Taxable|Amt|Sale$/
                      .test(
                        column
                      )

                      ? fmt(
                          row[column]
                        )

                      : (
                          row[column]
                          ??
                          ''
                        )

                  )
                }</td>`
            )

            .join('')

          +

          `<td>
            ${money(
              rowAverageSale(
                row
              )
            )}
          </td>`

          +

          '</tr>'

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

                  p_months:
                    [
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


    let header =

      `<th id="viewLabel">
        ${esc(
          viewName
        )}
      </th>`;


    analysisMonths

      .forEach(
        m => {

          header += `

            <th>
              ${esc(
                monthNames[m]
                ||
                m
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

      monthlyData

        .map(
          rows => {

            const map =
              new Map();


            (
              rows || []
            )

              .forEach(
                r =>
                  map.set(
                    String(
                      r.label
                    ),
                    Number(
                      r.sale
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

            const values =

              analysisMonths

                .map(
                  (
                    m,
                    i
                  ) =>
                    monthMaps[i]
                      ?.get(
                        String(
                          row.label
                        )
                      )
                    ||
                    0
                );


            const avg =

              values.length

                ? values.reduce(
                    (
                      a,
                      b
                    ) =>
                      a + b,

                    0
                  )
                  /
                  values.length

                : 0;


            const monthCells =

              values

                .map(
                  v =>
                    `<td>
                      ${money(v)}
                    </td>`
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
                    avg
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
========================================= */

async function loadComparison(){

  const actualMonth =

    el(
      'actualCompareMonth'
    )
      ?.value
    ||
    '';


  const compareMonths =
    selected.compareMonths;


  const setText =
    (
      id,
      val
    ) => {

      if(
        el(id)
      ){

        el(id).textContent =
          val;

      }

    };


  const statusEl =
    el(
      'compareStatus'
    );


  if(
    !compareMonths.length
    ||
    !actualMonth
  ){

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


    if(
      statusEl
    ){

      statusEl.textContent =
        'Select months';


      statusEl.className =
        'compare-status compare-neutral';

    }


    return;

  }


  try{

    const base =
      args();


    const compareResults =

      await Promise.all(

        compareMonths.map(
          m =>
            rpc(
              'raj_dashboard_summary',
              {

                ...base,

                p_months:
                  [
                    m
                  ]

              }
            )
        )

      );


    const actualResult =

      await rpc(
        'raj_dashboard_summary',
        {

          ...base,

          p_months:
            [
              actualMonth
            ]

        }
      );


    const sales =

      compareResults.map(
        r =>
          Number(
            r?.summary?.TotalSale
            ||
            0
          )
      );


    const avg =

      sales.length

        ? sales.reduce(
            (
              a,
              b
            ) =>
              a + b,

            0
          )
          /
          sales.length

        : 0;


    const actual =

      Number(
        actualResult?.summary?.TotalSale
        ||
        0
      );


    const diff =
      actual - avg;


    const pct =

      avg !== 0

        ? (
            diff
            /
            avg
          )
          *
          100

        : 0;


    setText(
      'compareAvgSale',
      money(
        avg
      )
    );


    setText(
      'compareActualSale',
      money(
        actual
      )
    );


    setText(
      'compareDifference',

      (
        diff >= 0
          ? '+'
          : ''
      )

      +

      money(
        diff
      )
    );


    setText(
      'comparePercent',

      (
        pct >= 0
          ? '+'
          : ''
      )

      +

      fmt(
        pct
      )

      +

      '%'
    );


    if(
      statusEl
    ){

      statusEl.textContent =

        diff > 0

          ? 'Above Avg'

          : diff < 0

            ? 'Below Avg'

            : 'Equal to Avg';


      statusEl.className =

        'compare-status '

        +

        (
          diff > 0

            ? 'compare-positive'

            : diff < 0

              ? 'compare-negative'

              : 'compare-neutral'
        );

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
      statusEl
    ){

      statusEl.textContent =
        'Comparison error';


      statusEl.className =
        'compare-status compare-negative';

    }

  }

}


/* =========================================
   BUDGET MONTHS
========================================= */

function budgetMonthsToShow(){

  const chosen =

    selected.month.length

      ? selected.month

      : months;


  const normalized =
    [];


  for(
    const month of chosen
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
   BUDGET RENDER
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


  showMonths

    .forEach(
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


            showMonths

              .forEach(
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


    if(
      el(
        'budgetTableBody'
      )
    ){

      el(
        'budgetTableBody'
      ).innerHTML = `

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
   MAIN DASHBOARD
========================================= */

async function loadDashboard(
  reload = false
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

    const a =
      args();


    const [
      summaryResult,
      rowsResult
    ] =

      await Promise.all(
        [

          rpc(
            'raj_dashboard_summary',
            a
          ),

          rpc(
            'raj_dashboard_rows',
            {

              ...a,

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
      Budget customers + zero sales
      month summary.
    */

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


    if(
      reload
    ){

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
        Detail table columns + Avg Sales.
      */

      if(
        el(
          'tableHead'
        )
      ){

        el(
          'tableHead'
        ).innerHTML =

          columns

            .map(
              c =>
                `<th>
                  ${esc(c)}
                </th>`
            )

            .join('')

          +

          '<th>Avg Sales</th>';

      }


      buildMonths();

      buildComparisonControls();


      /* MAIN CLICK HANDLER */

      document.addEventListener(
        'click',
        event => {

          const sa =

            event.target.closest(
              '[data-select-all]'
            );


          if(
            sa
          ){

            event.preventDefault();

            event.stopPropagation();


            applyBulkSelection(
              sa.dataset.selectAll,
              true
            );


            return;

          }


          const ua =

            event.target.closest(
              '[data-unselect-all]'
            );


          if(
            ua
          ){

            event.preventDefault();

            event.stopPropagation();


            applyBulkSelection(
              ua.dataset.unselectAll,
              false
            );


            return;

          }


          const button =

            event.target.closest(
              '[data-open]'
            );


          if(
            button
          ){

            const id =
              button.dataset.open;


            const box =
              el(
                'multi_' + id
              );


            if(
              !box
            ){

              return;

            }


            document

              .querySelectorAll(
                '.multi.open'
              )

              .forEach(
                x => {

                  if(
                    x !== box
                  ){

                    x.classList.remove(
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
              &&
              id !== 'compareMonths'
            ){

              const s =
                el(
                  'search_' + id
                );


              if(
                s
              ){

                s.value =
                  searchState[id]
                  ||
                  '';


                applySearchFilter(
                  id
                );


                requestAnimationFrame(
                  () =>
                    s.focus()
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
                x =>
                  x.classList.remove(
                    'open'
                  )
              );

          }

        }
      );


      /* SEARCH BOXES */

      for(
        const [id] of filterDefs
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


      /* INITIAL LOAD */

      await refreshFilters();

      await loadODOptions();

      await loadDashboard();


      /* ACTUAL COMPARE MONTH */

      if(
        el(
          'actualCompareMonth'
        )
      ){

        el(
          'actualCompareMonth'
        ).onchange =
          loadComparison;

      }


      /* PRODUCT STATUS */

      if(
        el(
          'productSaleStatus'
        )
      ){

        el(
          'productSaleStatus'
        ).onchange =
          async () => {

            page = 1;


            await loadDashboard(
              true
            );

          };

      }


      /* BUDGET STATUS */

      if(
        el(
          'budgetStatus'
        )
      ){

        el(
          'budgetStatus'
        ).onchange =
          async () => {

            budgetPage = 1;


            await loadBudget();

          };

      }


      /* BUDGET TARGET */

      if(
        el(
          'budgetTarget'
        )
      ){

        el(
          'budgetTarget'
        ).onchange =
          async () => {

            budgetPage = 1;


            await loadDashboard(
              false
            );

          };

      }


      /* GLOBAL SEARCH */

      if(
        el(
          'search'
        )
      ){

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


                  await loadDashboard(
                    true
                  );

                },

                350

              );

          };

      }


      /* PAGE SIZE */

      if(
        el(
          'pageSize'
        )
      ){

        el(
          'pageSize'
        ).onchange =
          async () => {

            page = 1;


            await loadDashboard();

          };

      }


      /* PREVIOUS PAGE */

      if(
        el(
          'prevPage'
        )
      ){

        el(
          'prevPage'
        ).onclick =
          async () => {

            if(
              page > 1
            ){

              page--;


              await loadDashboard();

            }

          };

      }


      /* NEXT PAGE */

      if(
        el(
          'nextPage'
        )
      ){

        el(
          'nextPage'
        ).onclick =
          async () => {

            if(
              page < totalPages
            ){

              page++;


              await loadDashboard();

            }

          };

      }


      /* BUDGET PREVIOUS */

      if(
        el(
          'budgetPrev'
        )
      ){

        el(
          'budgetPrev'
        ).onclick =
          () => {

            if(
              budgetPage > 1
            ){

              budgetPage--;


              renderBudget();

            }

          };

      }


      /* BUDGET NEXT */

      if(
        el(
          'budgetNext'
        )
      ){

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


            if(
              budgetPage < pages
            ){

              budgetPage++;


              renderBudget();

            }

          };

      }


      /* CLEAR FILTERS */

      if(
        el(
          'clearFilters'
        )
      ){

        el(
          'clearFilters'
        ).onclick =
          async () => {

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


            selected.month =
              [];


            selected.budgetOD =
              [];


            selected.compareMonths =
              [];


            odParties =
              [];


            Object

              .keys(
                searchState
              )

              .forEach(
                k =>
                  searchState[k] =
                    ''
              );


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


            if(
              el(
                'actualCompareMonth'
              )
            ){

              el(
                'actualCompareMonth'
              ).value =
                '';

            }


            filters

              .forEach(
                c => {

                  selected[c] =
                    [];


                  updateMultiLabel(
                    c
                  );

                }
              );


            updateMonthLabel();

            updateODLabel();

            updateCompareLabel();


            page = 1;

            budgetPage = 1;


            buildComparisonControls();


            await loadDashboard(
              true
            );

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
                    x =>
                      x.classList.remove(
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
