(() => {
'use strict';

/* =========================================================
   OUTSTANDING DASHBOARD
   DIRECT SOURCE COLUMN VERSION
========================================================= */

const $ = s => document.querySelector(s);

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

const PAGE_SIZE = 1000;
const DETAIL_PAGE_SIZE = 50;

let sb = null;
let rows = [];
let uploads = [];
let activeUpload = null;
let charts = {};
let detailPage = 1;
let comparisonRequestId = 0;

const snapshotCache = new Map();

let detailSort = {
  key: 'party',
  dir: 'asc'
};

let historySort = {
  key: 'outstanding_date',
  dir: 'desc'
};

/* =========================================================
   FILTERS
========================================================= */

const filterMap = [
  ['age_days', 'Days / Ageing'],
  ['party', 'Customer / Party'],
  ['sm', 'SM'],
  ['grp_name', 'GrpName'],
  ['division', 'Division'],
  ['area', 'Area'],
  ['order_type', 'OD / Order'],
  ['city', 'City'],
  ['pincode', 'Pincode']
];

const filterSelections = {};

filterMap.forEach(([key]) => {
  filterSelections[key] = new Set();
});

const AGE_FILTERS = {
  '15 Days':'days_15',
  '30 Days':'days_30',
  '45 Days':'days_45',
  '60 Days':'days_60',
  '75 Days':'days_75',
  '90 Days':'days_90',
  '120 Days':'days_120',
  '150 Days':'days_150'
};

/* =========================================================
   AGEING DEFINITIONS

   IMPORTANT:
   NO SUBTRACTION / DERIVED CALCULATION.

   Each dashboard bucket uses the uploaded
   source column directly.
========================================================= */

const bucketDefs = [
  ['0-15', 'days_15'],
  ['16-30', 'days_30'],
  ['31-45', 'days_45'],
  ['46-60', 'days_60'],
  ['61-75', 'days_75'],
  ['76-90', 'days_90'],
  ['91-120', 'days_120'],
  ['121-150', 'days_150'],
  ['PDC', 'pdc']
];

const customerBucketDefs = [
  ['0-15', 'days_15'],
  ['16-30', 'days_30'],
  ['31-45', 'days_45'],
  ['46-60', 'days_60'],
  ['61-75', 'days_75'],
  ['76-90', 'days_90'],
  ['91-120', 'days_120'],
  ['121-150', 'days_150']
];



/* =========================================================
   ROLE / SALES ALLOCATION SCOPE
   Reuses raj_dashboard_user SM / OD access.
========================================================= */
function storedUser(){
  try{return JSON.parse(localStorage.getItem(USER)||'{}')||{};}catch{return {};}
}
function codeList(value){
  if(Array.isArray(value)) return [...new Set(value.map(v=>String(v).trim()).filter(Boolean))];
  if(value==null||value==='') return [];
  return [...new Set(String(value).split(/[,;|]/).map(v=>v.trim()).filter(Boolean))];
}
function isAdmin(){
  const u=storedUser();
  return String(u.role||'').toLowerCase()==='admin'||u.full_view===true||u.fullView===true;
}
function roleScopedRows(source){
  const u=storedUser();
  if(isAdmin()) return source;
  const role=String(u.role||'').toLowerCase();
  const sm=codeList(u.sm_access).filter(v=>v.toUpperCase()!=='ALL');
  const od=codeList(u.od_access).filter(v=>v.toUpperCase()!=='ALL');
  return source.filter(row=>{
    const rsm=String(row.sm??'').trim();
    const rod=String(row.order_type??'').trim();
    if(role==='sm') return sm.length>0 && sm.includes(rsm);
    if(role==='od') return od.length>0 && od.includes(rod);
    if(role==='saleshead'){
      const smOk=!sm.length||sm.includes(rsm);
      const odOk=!od.length||od.includes(rod);
      return smOk&&odOk;
    }
    return false;
  });
}
function applyRoleUi(){
  const admin=isAdmin();
  document.querySelectorAll('.admin-upload').forEach(el=>el.style.display=admin?'':'none');
  const logs=document.getElementById('logsBtn'); if(logs) logs.style.display=admin?'':'none';
}
function initOutstandingDrawer(){
  const sidebar=document.querySelector('.sidebar');
  const toggle=document.getElementById('odFilterToggle');
  if(!sidebar||!toggle) return;
  const close=()=>{sidebar.classList.remove('od-open');document.body.classList.remove('od-drawer-open');};
  toggle.addEventListener('click',e=>{e.stopPropagation();const open=!sidebar.classList.contains('od-open');sidebar.classList.toggle('od-open',open);document.body.classList.toggle('od-drawer-open',open);});
  sidebar.addEventListener('click',e=>e.stopPropagation());
  document.addEventListener('click',()=>{if(innerWidth<=900) close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') close();});
}

/* =========================================================
   BASIC HELPERS
========================================================= */

function num(v) {
  if (
    v === null ||
    v === undefined ||
    v === ''
  ) {
    return 0;
  }

  const n = Number(
    String(v)
      .replace(/,/g, '')
      .trim()
  );

  return Number.isFinite(n) ? n : 0;
}

function money(v) {
  return '₹ ' +
    Math.round(num(v))
      .toLocaleString('en-IN');
}

function esc(v) {
  return String(v ?? '')
    .replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
}

function toast(message, stay = false) {
  console.log('[Outstanding]', message);

  const el = $('#toast');

  if (!el) return;

  el.textContent = message;
  el.style.display = 'block';

  clearTimeout(toast.timer);

  if (!stay) {
    toast.timer = setTimeout(() => {
      el.style.display = 'none';
    }, 3500);
  }
}

function fatal(error) {
  console.error(
    '[Outstanding Dashboard]',
    error
  );

  toast(
    'Dashboard error: ' +
    (error?.message || String(error)),
    true
  );
}

/* =========================================================
   SUPABASE / AUTH
========================================================= */

function authArgs(extra = {}) {
  return {
    p_session_token:
      localStorage.getItem(TOKEN) || '',

    p_device_id:
      localStorage.getItem(DEVICE) || '',

    ...extra
  };
}

async function rpc(name, args = {}) {
  const { data, error } =
    await sb.rpc(
      name,
      authArgs(args)
    );

  if (error) {
    throw new Error(
      `${name}: ${error.message}`
    );
  }

  return data;
}

async function guard() {
  if (!localStorage.getItem(TOKEN)) {
    location.href = 'index.html';
    return false;
  }

  toast('Checking session...', true);

  const { data, error } =
    await sb.rpc(
      'raj_app_validate_session',
      authArgs()
    );

  if (error) {
    throw new Error(
      'Session check failed: ' +
      error.message
    );
  }

  if (!data || data.success !== true) {
    location.href = 'index.html';
    return false;
  }

  if (data.user) {
    localStorage.setItem(USER, JSON.stringify(data.user));
  }
  applyRoleUi();
  return true;
}

/* =========================================================
   LOAD ALL ROWS - PAGINATION
========================================================= */

async function getAllOutstandingRows(
  uploadId,
  message = 'Loading'
) {
  const result = [];
  let offset = 0;

  while (true) {
    toast(
      `${message}: ${result.length.toLocaleString('en-IN')} rows loaded...`,
      true
    );

    const response =
      await sb.rpc(
        'raj_outstanding_get_rows',
        authArgs({
          p_upload_id: uploadId,
          p_offset: offset,
          p_limit: PAGE_SIZE
        })
      );

    if (response.error) {
      throw new Error(
        'raj_outstanding_get_rows: ' +
        response.error.message
      );
    }

    const page =
      Array.isArray(response.data)
        ? response.data
        : [];

    result.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;

    if (offset > 100000) {
      throw new Error(
        'Pagination safety limit reached.'
      );
    }
  }

  return result;
}

/* =========================================================
   DIRECT SOURCE AGEING VALUES

   NO:
   15 - 30
   30 - 45
   90 - 120
   etc.

   Whatever is stored in that column is used directly.
========================================================= */

function bucket(row) {
  return {
    days_15:
      Math.max(
        0,
        num(row.days_15)
      ),

    days_30:
      Math.max(
        0,
        num(row.days_30)
      ),

    days_45:
      Math.max(
        0,
        num(row.days_45)
      ),

    days_60:
      Math.max(
        0,
        num(row.days_60)
      ),

    days_75:
      Math.max(
        0,
        num(row.days_75)
      ),

    days_90:
      Math.max(
        0,
        num(row.days_90)
      ),

    days_120:
      Math.max(
        0,
        num(row.days_120)
      ),

    days_150:
      Math.max(
        0,
        num(row.days_150)
      ),

    pdc:
      Math.max(
        0,
        num(row.pdc)
      )
  };
}

/* =========================================================
   FILTER LOGIC
========================================================= */

function rowMatches(row, ignoreKey = null) {
  return filterMap.every(([key]) => {
    if (key === ignoreKey) {
      return true;
    }

    const selected =
      filterSelections[key];

    if (!selected.size) {
      return true;
    }

    if (key === 'age_days') {
      return [...selected].some(label => {
        const field = AGE_FILTERS[label];
        return field && num(row[field]) > 0;
      });
    }

    const value =
      String(row[key] ?? '').trim();

    return selected.has(value);
  });
}

function filtered(source = rows) {
  return roleScopedRows(source).filter(
    row => rowMatches(row)
  );
}

function availableValues(key) {
  if (key === 'age_days') {
    return Object.keys(AGE_FILTERS);
  }
  return [
    ...new Set(
      roleScopedRows(rows)
        .filter(
          row =>
            rowMatches(row, key)
        )
        .map(
          row =>
            String(
              row[key] ?? ''
            ).trim()
        )
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  );
}

function pruneSelections() {
  let changed = true;
  let pass = 0;

  while (changed && pass < 12) {
    changed = false;
    pass++;

    for (const [key] of filterMap) {
      const available =
        new Set(
          availableValues(key)
        );

      for (
        const value
        of [...filterSelections[key]]
      ) {
        if (!available.has(value)) {
          filterSelections[key]
            .delete(value);

          changed = true;
        }
      }
    }
  }
}

function filterTitle(key, label) {
  const selected =
    filterSelections[key];

  if (!selected.size) {
    return `All ${label}`;
  }

  if (selected.size === 1) {
    return [...selected][0];
  }

  return `${selected.size} selected`;
}

function renderFilterOptions(key) {
  const box =
    document.querySelector(
      `.ms[data-key="${key}"]`
    );

  if (!box) return;

  const definition =
    filterMap.find(
      x => x[0] === key
    );

  if (!definition) return;

  const label =
    definition[1];

  const search =
    String(
      box.querySelector(
        '.ms-search'
      )?.value || ''
    )
      .trim()
      .toLowerCase();

  const values =
    availableValues(key)
      .filter(
        v =>
          v.toLowerCase()
            .includes(search)
      );

  const options =
    box.querySelector(
      '.ms-options'
    );

  if (!options) return;

  options.innerHTML =
    values.length
      ? values.map(value => `
          <label class="ms-option">
            <input
              type="checkbox"
              value="${esc(value)}"
              ${
                filterSelections[key]
                  .has(value)
                  ? 'checked'
                  : ''
              }
            >
            <span>
              ${esc(value)}
            </span>
          </label>
        `).join('')
      : `
          <div class="ms-empty">
            No matching options
          </div>
        `;

  const trigger =
    box.querySelector(
      '.ms-trigger'
    );

  if (trigger) {
    trigger.textContent =
      filterTitle(
        key,
        label
      );
  }

  options
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(input => {
      input.onchange = () => {
        if (input.checked) {
          filterSelections[key]
            .add(input.value);
        } else {
          filterSelections[key]
            .delete(input.value);
        }

        filtersChanged();
      };
    });
}

function refreshFilters() {
  filterMap.forEach(
    ([key]) => {
      renderFilterOptions(key);
    }
  );
}

function filtersChanged() {
  pruneSelections();

  detailPage = 1;

  refreshFilters();

  render();
}

function makeFilters() {
  const container =
    $('#filters');

  if (!container) return;

  container.innerHTML =
    filterMap.map(
      ([key, label]) => `
        <div class="field">
          <label>
            ${esc(label)}
          </label>

          <div
            class="ms"
            data-key="${key}"
          >
            <button
              type="button"
              class="ms-trigger"
            >
              ${esc(
                filterTitle(
                  key,
                  label
                )
              )}
            </button>

            <div class="ms-menu">

              <div class="ms-search-wrap">
                <input
                  class="ms-search"
                  type="search"
                  placeholder="Search ${esc(label)}..."
                >
              </div>

              <div class="ms-actions">

                <button
                  type="button"
                  data-act="all"
                >
                  Select visible
                </button>

                <button
                  type="button"
                  data-act="clear"
                >
                  Clear
                </button>

              </div>

              <div
                class="ms-options"
              ></div>

            </div>
          </div>
        </div>
      `
    ).join('');

  container
    .querySelectorAll('.ms')
    .forEach(box => {
      const key =
        box.dataset.key;

      const trigger =
        box.querySelector(
          '.ms-trigger'
        );

      const menu =
        box.querySelector(
          '.ms-menu'
        );

      const search =
        box.querySelector(
          '.ms-search'
        );

      const all =
        box.querySelector(
          '[data-act="all"]'
        );

      const clear =
        box.querySelector(
          '[data-act="clear"]'
        );

      trigger.onclick =
        event => {
          event.stopPropagation();

          document
            .querySelectorAll(
              '.ms.open'
            )
            .forEach(other => {
              if (other !== box) {
                other.classList
                  .remove('open');
              }
            });

          box.classList
            .toggle('open');

          renderFilterOptions(key);

          if (
            box.classList
              .contains('open')
          ) {
            setTimeout(
              () =>
                search?.focus(),
              20
            );
          }
        };

      menu.onclick =
        event =>
          event.stopPropagation();

      search.oninput =
        () =>
          renderFilterOptions(key);

      clear.onclick =
        () => {
          filterSelections[key]
            .clear();

          search.value = '';

          filtersChanged();
        };

      all.onclick =
        () => {
          const q =
            String(
              search.value || ''
            )
              .trim()
              .toLowerCase();

          availableValues(key)
            .filter(
              v =>
                v.toLowerCase()
                  .includes(q)
            )
            .forEach(
              v =>
                filterSelections[key]
                  .add(v)
            );

          filtersChanged();
        };
    });

  refreshFilters();
}

document.addEventListener(
  'click',
  () => {
    document
      .querySelectorAll(
        '.ms.open'
      )
      .forEach(
        box =>
          box.classList
            .remove('open')
      );
  }
);

/* =========================================================
   METRICS - DIRECT COLUMN TOTALS
========================================================= */

function sum(data, key) {
  return data.reduce(
    (total, row) =>
      total + num(row[key]),
    0
  );
}

function metrics(data) {
  const bs = {};

  bucketDefs.forEach(
    ([, key]) => {
      bs[key] =
        data.reduce(
          (total, row) =>
            total +
            bucket(row)[key],
          0
        );
    }
  );

  return {
    total:
      sum(data, 'balance'),

    customers:
      new Set(
        data
          .map(
            row =>
              String(
                row.party ?? ''
              ).trim()
          )
          .filter(Boolean)
      ).size,

    pdc:
      sum(data, 'pdc'),

    /*
      Direct source column totals.
    */
    over30: sum(data, 'days_30'),
    over45: sum(data, 'days_45'),
    over60: sum(data, 'days_60'),
    over75: sum(data, 'days_75'),
    over90: sum(data, 'days_90'),
    over120: sum(data, 'days_120'),
    over150: sum(data, 'days_150'),

    bs
  };
}

/* =========================================================
   CHART
========================================================= */

function draw(
  selector,
  type,
  labels,
  datasets,
  options = {}
) {
  if (charts[selector]) {
    charts[selector].destroy();
  }

  const canvas =
    $(selector);

  if (!canvas) return;

  charts[selector] =
    new Chart(
      canvas,
      {
        type,

        data: {
          labels,
          datasets
        },

        options: {
          responsive: true,
          maintainAspectRatio: false,

          interaction: {
            mode: 'index',
            intersect: false
          },

          plugins: {
            legend: {
              display:
                type === 'doughnut' ||
                !!options.legend
            },

            tooltip: {
              callbacks: {
                label(context) {
                  const prefix =
                    context.dataset
                      .label
                      ? context.dataset
                          .label + ': '
                      : '';

                  if (
                    options.countChart
                  ) {
                    return (
                      prefix +
                      Number(
                        context.raw || 0
                      ).toLocaleString(
                        'en-IN'
                      )
                    );
                  }

                  return (
                    prefix +
                    money(
                      context.raw || 0
                    )
                  );
                }
              }
            }
          },

          scales:
            type === 'doughnut'
              ? {}
              : {
                  y: {
                    beginAtZero: true,

                    ticks: {
                      precision:
                        options.countChart
                          ? 0
                          : undefined,

                      callback(value) {
                        const n =
                          Number(value);

                        if (
                          options.countChart
                        ) {
                          return n
                            .toLocaleString(
                              'en-IN'
                            );
                        }

                        if (
                          Math.abs(n) >=
                          10000000
                        ) {
                          return (
                            n / 10000000
                          ).toFixed(1) +
                          ' Cr';
                        }

                        if (
                          Math.abs(n) >=
                          100000
                        ) {
                          return (
                            n / 100000
                          ).toFixed(1) +
                          ' L';
                        }

                        if (
                          Math.abs(n) >=
                          1000
                        ) {
                          return (
                            n / 1000
                          ).toFixed(0) +
                          ' K';
                        }

                        return n;
                      }
                    }
                  },

                  x: {
                    grid: {
                      display: false
                    }
                  }
                }
        }
      }
    );
}




 /* =========================================================
   SIMPLE TABLE
========================================================= */

function simpleTable(items, columns) {
  return `
    <table>
      <thead>
        <tr>
          ${columns.map(column => `
            <th class="${
              column.num ? 'num' : ''
            }">
              ${esc(column.label)}
            </th>
          `).join('')}
        </tr>
      </thead>

      <tbody>
        ${
          items.length
            ? items.map(
                (row, index) => `
                  <tr>
                    ${columns.map(
                      column => `
                        <td class="${
                          column.num
                            ? 'num'
                            : ''
                        }">
                          ${
                            column.render
                              ? column.render(
                                  row,
                                  index
                                )
                              : esc(
                                  row[
                                    column.key
                                  ] ?? ''
                                )
                          }
                        </td>
                      `
                    ).join('')}
                  </tr>
                `
              ).join('')
            : `
                <tr>
                  <td
                    colspan="${columns.length}"
                    class="muted"
                  >
                    No data
                  </td>
                </tr>
              `
        }
      </tbody>
    </table>
  `;
}

/* =========================================================
   SORT HELPERS
========================================================= */

const numericFields = new Set([
  'balance',
  'days_15',
  'days_30',
  'days_45',
  'days_60',
  'days_75',
  'days_90',
  'days_120',
  'days_150',
  'pdc',
  'total_customers',
  'total_outstanding',
  'total_pdc'
]);

function compareValues(a, b, key) {
  if (numericFields.has(key)) {
    return (
      num(a?.[key]) -
      num(b?.[key])
    );
  }

  return String(
    a?.[key] ?? ''
  ).localeCompare(
    String(b?.[key] ?? ''),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}

function sortArrow(sort, key) {
  if (sort.key !== key) {
    return '';
  }

  return sort.dir === 'asc'
    ? ' ▲'
    : ' ▼';
}

/* =========================================================
   CUSTOMER DETAILS
========================================================= */

function renderDetails(data) {
  const container =
    $('#customerDetails');

  if (!container) {
    return;
  }

  const search =
    String(
      $('#detailSearch')?.value ||
      ''
    )
      .trim()
      .toLowerCase();

  let list = [...data];

  if (search) {
    list = list.filter(row =>
      [
        row.party,
        row.sm,
        row.grp_name,
        row.division,
        row.area,
        row.order_type,
        row.city,
        row.pincode
      ].some(value =>
        String(value ?? '')
          .toLowerCase()
          .includes(search)
      )
    );
  }

  list.sort((a, b) => {
    const result =
      compareValues(
        a,
        b,
        detailSort.key
      );

    return detailSort.dir === 'asc'
      ? result
      : -result;
  });

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        list.length /
        DETAIL_PAGE_SIZE
      )
    );

  detailPage =
    Math.min(
      Math.max(detailPage, 1),
      totalPages
    );

  const start =
    (detailPage - 1) *
    DETAIL_PAGE_SIZE;

  const pageRows =
    list.slice(
      start,
      start + DETAIL_PAGE_SIZE
    );

  const columns = [
    ['party', 'Party', false],
    ['balance', 'Balance', true],
    ['days_15', '15', true],
    ['days_30', '30', true],
    ['days_45', '45', true],
    ['days_60', '60', true],
    ['days_75', '75', true],
    ['days_90', '90', true],
    ['days_120', '120', true],
    ['days_150', '150', true],
    ['pdc', 'PDC', true],
    ['sm', 'SM', false],
    ['grp_name', 'GrpName', false],
    ['division', 'Division', false],
    ['area', 'Area', false],
    [
      'order_type',
      'OD / Order',
      false
    ],
    ['city', 'City', false],
    ['pincode', 'Pincode', false]
  ];

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          ${columns.map(
            ([key, label, numeric]) => `
              <th
                class="sortable ${
                  numeric
                    ? 'num'
                    : ''
                }"
                data-detail-sort="${key}"
              >
                ${esc(label)}
                ${sortArrow(
                  detailSort,
                  key
                )}
              </th>
            `
          ).join('')}
        </tr>
      </thead>

      <tbody>
        ${
          pageRows.length
            ? pageRows.map(row => `
                <tr>
                  ${columns.map(
                    ([key, , numeric]) => `
                      <td class="${
                        numeric
                          ? 'num'
                          : ''
                      }">
                        ${
                          numeric
                            ? money(
                                row[key]
                              )
                            : esc(
                                row[key] ??
                                ''
                              )
                        }
                      </td>
                    `
                  ).join('')}
                </tr>
              `).join('')
            : `
                <tr>
                  <td
                    colspan="${columns.length}"
                    class="muted"
                  >
                    No matching data
                  </td>
                </tr>
              `
        }
      </tbody>
    </table>
  `;

  if ($('#detailCount')) {
    $('#detailCount')
      .textContent =
        `${list.length.toLocaleString(
          'en-IN'
        )} rows`;
  }

  if ($('#pageInfo')) {
    $('#pageInfo')
      .textContent =
        `Page ${detailPage} of ${totalPages}`;
  }

  if ($('#prevPage')) {
    $('#prevPage').disabled =
      detailPage <= 1;
  }

  if ($('#nextPage')) {
    $('#nextPage').disabled =
      detailPage >= totalPages;
  }

  container
    .querySelectorAll(
      '[data-detail-sort]'
    )
    .forEach(th => {
      th.onclick = () => {
        const key =
          th.dataset.detailSort;

        if (
          detailSort.key === key
        ) {
          detailSort.dir =
            detailSort.dir === 'asc'
              ? 'desc'
              : 'asc';
        } else {
          detailSort = {
            key,
            dir: 'asc'
          };
        }

        detailPage = 1;

        renderDetails(
          filtered()
        );
      };
    });
}

/* =========================================================
   ACTIVE FILTER SUMMARY + KPI DRILLDOWN
========================================================= */
function renderActiveFilters(){
  let bar = document.getElementById('odActiveFilters');
  if(!bar){
    const kpis = document.getElementById('kpis');
    if(!kpis) return;
    bar = document.createElement('div');
    bar.id = 'odActiveFilters';
    bar.className = 'active-filter-bar';
    kpis.insertAdjacentElement('beforebegin', bar);
  }
  const chips=[];
  filterMap.forEach(([key,label])=>{
    const vals=[...(filterSelections[key]||[])];
    if(vals.length) chips.push(`<span><b>${esc(label)}:</b> ${esc(vals.join(', '))}</span>`);
  });
  bar.innerHTML = chips.length
    ? `<strong>Active Filters</strong>${chips.join('')}`
    : `<strong>Active Filters</strong><span>All Data</span>`;
}

function drillToAge(label){
  filterSelections.age_days.clear();
  if(label) filterSelections.age_days.add(label);
  detailPage = 1;
  refreshFilters();
  render();
  setTimeout(()=>{
    document.getElementById('customerDetails')?.closest('.card')?.scrollIntoView({behavior:'smooth',block:'start'});
  },50);
}

/* =========================================================
   MAIN DASHBOARD RENDER
========================================================= */

function render() {
  renderActiveFilters();

  const data =
    filtered();

  const currentMetrics =
    metrics(data);

  /* =====================================================
     KPI CARDS
  ===================================================== */

  const kpis =
    $('#kpis');

  if (kpis) {
    const cards = [
      ['Total Outstanding', money(currentMetrics.total), ''],
      ['Total Customers', currentMetrics.customers.toLocaleString('en-IN'), ''],
      ['PDC Amount', money(currentMetrics.pdc), ''],
      ['Over 30 Days', money(currentMetrics.over30), '30 Days'],
      ['Over 45 Days', money(currentMetrics.over45), '45 Days'],
      ['Over 60 Days', money(currentMetrics.over60), '60 Days'],
      ['Over 75 Days', money(currentMetrics.over75), '75 Days'],
      ['Over 90 Days', money(currentMetrics.over90), '90 Days'],
      ['Over 120 Days', money(currentMetrics.over120), '120 Days'],
      ['Over 150 Days', money(currentMetrics.over150), '150 Days']
    ];

    kpis.innerHTML =
      cards.map(([label, value, age]) => `
        <article class="kpi ${age ? 'kpi-clickable' : ''}" ${age ? `data-age="${esc(age)}" title="Show ${esc(age)} customers"` : ''}>
          <span>${esc(label)}</span>
          <strong>${esc(value)}</strong>
          <small>${age ? 'Click to view customers' : 'Current snapshot'}</small>
        </article>
      `).join('');

    kpis.querySelectorAll('[data-age]').forEach(card => {
      card.onclick = () => drillToAge(card.dataset.age);
    });
  }

  /* =====================================================
     AGEING ANALYSIS

     IMPORTANT:
     These are DIRECT uploaded column totals.
     No subtraction is done here.
  ===================================================== */

  const ageingLabels =
    bucketDefs.map(
      item => item[0]
    );

  const ageingValues =
    bucketDefs.map(
      item =>
        currentMetrics.bs[
          item[1]
        ]
    );

  draw(
    '#ageChart',
    'bar',
    ageingLabels,
    [
      {
        label:
          'Source Column Total',

        data:
          ageingValues,

        borderRadius: 6
      }
    ]
  );

  /* =====================================================
     OUTSTANDING BREAKUP
  ===================================================== */

  draw(
    '#donutChart',
    'doughnut',
    ageingLabels,
    [
      {
        label:
          'Source Column Total',

        data:
          ageingValues,

        borderWidth: 0
      }
    ],
    {
      legend: true
    }
  );

  /* =====================================================
     AGEING WISE CUSTOMER COUNT > ₹1,000

     Here also NO ageing subtraction is done.

     Example:
     76-90 uses row.days_90 directly.

     If that direct column value is > ₹1,000,
     that customer is counted in the 76-90 bar.
  ===================================================== */

  const ageingCustomerCounts =
    customerBucketDefs.map(
      ([label, key]) => {
        const customers =
          new Set();

        data.forEach(row => {
          const amount =
            bucket(row)[key];

          if (amount > 1000) {
            const party =
              String(
                row.party ?? ''
              ).trim();

            if (party) {
              customers.add(
                party
              );
            }
          }
        });

        return customers.size;
      }
    );

  draw(
    '#rangeChart',
    'bar',
    customerBucketDefs.map(
      item => item[0]
    ),
    [
      {
        label:
          'Customers > ₹1,000',

        data:
          ageingCustomerCounts,

        borderRadius: 6
      }
    ],
    {
      countChart: true
    }
  );

  /* =====================================================
     TOP 5 CUSTOMERS BY OUTSTANDING
  ===================================================== */

  const topCustomers =
    [...data]
      .sort(
        (a, b) =>
          num(b.balance) -
          num(a.balance)
      )
      .slice(0, 5);

  if ($('#topCustomers')) {
    $('#topCustomers')
      .innerHTML =
        simpleTable(
          topCustomers,
          [
            {
              label: '#',

              render:
                (row, index) =>
                  index + 1
            },

            {
              label:
                'Party Name',

              key:
                'party'
            },

            {
              label:
                'Balance',

              num: true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  /* =====================================================
     TOP 5 OVERDUE CUSTOMERS - 150 COLUMN
  ===================================================== */

  const overdue =
    [...data]
      .filter(
        row =>
          num(
            row.days_150
          ) > 0
      )
      .sort(
        (a, b) =>
          num(
            b.days_150
          ) -
          num(
            a.days_150
          )
      )
      .slice(0, 5);

  if ($('#overdueCustomers')) {
    $('#overdueCustomers')
      .innerHTML =
        simpleTable(
          overdue,
          [
            {
              label: '#',

              render:
                (row, index) =>
                  index + 1
            },

            {
              label:
                'Party Name',

              key:
                'party'
            },

            {
              label:
                '150',

              num: true,

              render:
                row =>
                  money(
                    row.days_150
                  )
            },

            {
              label:
                'Balance',

              num: true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  /* CUSTOMER DETAILS */

  renderDetails(data);

  /* COMPARISON */

  renderCompare(
    currentMetrics
  ).catch(error => {
    console.error(error);
  });
}

/* =========================================================
   COMPARISON SNAPSHOT SELECTOR
========================================================= */

function populateCompareSelector() {
  const select =
    $('#compareSnapshotSelect');

  if (!select) {
    return;
  }

  const oldValue =
    select.value;

  const available =
    uploads.filter(
      upload =>
        upload.id !==
        activeUpload?.id
    );

  select.innerHTML = `
    <option value="">
      Select snapshot
    </option>

    ${
      available.map(
        upload => `
          <option
            value="${esc(
              upload.id
            )}"
          >
            ${esc(
              upload.outstanding_date
            )}
          </option>
        `
      ).join('')
    }
  `;

  if (
    oldValue &&
    available.some(
      upload =>
        upload.id ===
        oldValue
    )
  ) {
    select.value =
      oldValue;

    return;
  }

  const currentIndex =
    uploads.findIndex(
      upload =>
        upload.id ===
        activeUpload?.id
    );

  const previous =
    currentIndex >= 0
      ? uploads[
          currentIndex + 1
        ]
      : null;

  if (previous) {
    select.value =
      previous.id;
  }
}

/* =========================================================
   COMPARISON ROW CACHE
========================================================= */

async function getComparisonRows(
  uploadId
) {
  if (
    snapshotCache.has(
      uploadId
    )
  ) {
    return snapshotCache.get(
      uploadId
    );
  }

  const data =
    await getAllOutstandingRows(
      uploadId,
      'Loading comparison'
    );

  snapshotCache.set(
    uploadId,
    data
  );

  return data;
}

/* =========================================================
   COMPARISON
========================================================= */

async function renderCompare(
  currentMetrics
) {
  const select =
    $('#compareSnapshotSelect');

  if (
    !activeUpload ||
    !select
  ) {
    return;
  }

  const compareId =
    select.value;

  const requestId =
    ++comparisonRequestId;

  if (!compareId) {
    if ($('#summaryCompare')) {
      $('#summaryCompare')
        .innerHTML = `
          <span class="muted">
            Select a snapshot in Compare With.
          </span>
        `;
    }

    draw(
      '#compareChart',
      'bar',
      [],
      []
    );

    return;
  }

  const compareUpload =
    uploads.find(
      upload =>
        upload.id ===
        compareId
    );

  if (!compareUpload) {
    return;
  }

  try {
    const compareRows =
      await getComparisonRows(
        compareId
      );

    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    /*
      Apply SAME selected filters
      to comparison snapshot.
    */

    const compareFiltered =
      roleScopedRows(compareRows).filter(
        row =>
          rowMatches(row)
      );

    const compareMetrics =
      metrics(
        compareFiltered
      );

    /* ===================================================
       COMPARISON CHART

       Direct source columns on BOTH snapshots.
    =================================================== */

    draw(
      '#compareChart',
      'bar',
      bucketDefs.map(
        item => item[0]
      ),
      [
        {
          label:
            compareUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                compareMetrics.bs[
                  item[1]
                ]
            )
        },

        {
          label:
            activeUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                currentMetrics.bs[
                  item[1]
                ]
            )
        }
      ],
      {
        legend: true
      }
    );

    /* ===================================================
       SUMMARY COMPARISON
    =================================================== */

    const comparisonTable = [
      {
        metric:
          'Total Outstanding',

        previous:
          compareMetrics.total,

        current:
          currentMetrics.total
      },

      {
        metric:
          'Total Customers',

        previous:
          compareMetrics.customers,

        current:
          currentMetrics.customers,

        count: true
      },

      {
        metric:
          'PDC Amount',

        previous:
          compareMetrics.pdc,

        current:
          currentMetrics.pdc
      },

      {
        metric:
          'Over 90 Days',

        previous:
          compareMetrics.over90,

        current:
          currentMetrics.over90
      },

      {
        metric:
          'Over 150 Days',

        previous:
          compareMetrics.over150,

        current:
          currentMetrics.over150
      }
    ];

    if ($('#summaryCompare')) {
      $('#summaryCompare')
        .innerHTML =
          simpleTable(
            comparisonTable,
            [
              {
                label:
                  'Metric',

                key:
                  'metric'
              },

              {
                label:
                  compareUpload
                    .outstanding_date,

                num: true,

                render:
                  row =>
                    row.count
                      ? Number(
                          row.previous
                        ).toLocaleString(
                          'en-IN'
                        )
                      : money(
                          row.previous
                        )
              },

              {
                label:
                  activeUpload
                    .outstanding_date,

                num: true,

                render:
                  row =>
                    row.count
                      ? Number(
                          row.current
                        ).toLocaleString(
                          'en-IN'
                        )
                      : money(
                          row.current
                        )
              }
            ]
          );
    }

  } catch (error) {
    console.error(
      'Comparison error:',
      error
    );

    if ($('#summaryCompare')) {
      $('#summaryCompare')
        .innerHTML = `
          <span class="muted">
            Comparison unavailable.
          </span>
        `;
    }
  }
}






 /* =========================================================
   SNAPSHOT HISTORY
========================================================= */

function renderHistory() {
  const container =
    $('#snapshotHistory');

  if (!container) return;

  let list =
    [...uploads];

  list.sort((a, b) => {
    const result =
      compareValues(
        a,
        b,
        historySort.key
      );

    return historySort.dir === 'asc'
      ? result
      : -result;
  });

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th
            class="sortable"
            data-history-sort="outstanding_date"
          >
            Snapshot Date
            ${sortArrow(
              historySort,
              'outstanding_date'
            )}
          </th>

          <th
            class="sortable"
            data-history-sort="total_customers"
          >
            Customers
            ${sortArrow(
              historySort,
              'total_customers'
            )}
          </th>

          <th
            class="sortable"
            data-history-sort="total_outstanding"
          >
            Outstanding
            ${sortArrow(
              historySort,
              'total_outstanding'
            )}
          </th>

          <th
            class="sortable"
            data-history-sort="total_pdc"
          >
            PDC
            ${sortArrow(
              historySort,
              'total_pdc'
            )}
          </th>

          <th>
            File
          </th>
        </tr>
      </thead>

      <tbody>
        ${
          list.length
            ? list.map(upload => `
                <tr>
                  <td>
                    ${esc(
                      upload.outstanding_date ||
                      ''
                    )}
                  </td>

                  <td class="num">
                    ${num(
                      upload.total_customers
                    ).toLocaleString(
                      'en-IN'
                    )}
                  </td>

                  <td class="num">
                    ${money(
                      upload.total_outstanding
                    )}
                  </td>

                  <td class="num">
                    ${money(
                      upload.total_pdc
                    )}
                  </td>

                  <td>
                    ${esc(
                      upload.file_name ||
                      ''
                    )}
                  </td>
                </tr>
              `).join('')
            : `
                <tr>
                  <td
                    colspan="5"
                    class="muted"
                  >
                    No snapshot history
                  </td>
                </tr>
              `
        }
      </tbody>
    </table>
  `;

  container
    .querySelectorAll(
      '[data-history-sort]'
    )
    .forEach(th => {
      th.onclick = () => {
        const key =
          th.dataset.historySort;

        if (
          historySort.key === key
        ) {
          historySort.dir =
            historySort.dir === 'asc'
              ? 'desc'
              : 'asc';
        } else {
          historySort = {
            key,
            dir: 'asc'
          };
        }

        renderHistory();
      };
    });
}

/* =========================================================
   SNAPSHOT SELECTOR
========================================================= */

function populateSnapshotSelector() {
  const select =
    $('#snapshotSelect');

  if (!select) return;

  select.innerHTML =
    uploads.map(upload => `
      <option
        value="${esc(upload.id)}"
      >
        ${esc(
          upload.outstanding_date
        )}
      </option>
    `).join('');

  if (activeUpload) {
    select.value =
      activeUpload.id;
  }
}

/* =========================================================
   LOAD SELECTED SNAPSHOT
========================================================= */

async function loadSnapshot(
  uploadId
) {
  const upload =
    uploads.find(
      item =>
        item.id === uploadId
    );

  if (!upload) {
    throw new Error(
      'Snapshot not found.'
    );
  }

  toast(
    `Loading ${upload.outstanding_date}...`,
    true
  );

  activeUpload =
    upload;

  rows =
    await getAllOutstandingRows(
      upload.id,
      'Loading outstanding'
    );

  snapshotCache.set(
    upload.id,
    rows
  );

  /*
    Clear old filter selections
    when snapshot changes.
  */

  filterMap.forEach(
    ([key]) =>
      filterSelections[key]
        .clear()
  );

  detailPage = 1;

  populateSnapshotSelector();

  populateCompareSelector();

  makeFilters();

  render();

  toast(
    `${rows.length.toLocaleString(
      'en-IN'
    )} rows loaded`
  );
}

/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function load() {
  toast(
    'Loading snapshots...',
    true
  );

  const data =
    await rpc(
      'raj_outstanding_list_uploads'
    );

  uploads =
    Array.isArray(data)
      ? data
      : [];

  uploads.sort(
    (a, b) => {
      const dateCompare =
        String(
          b.outstanding_date || ''
        ).localeCompare(
          String(
            a.outstanding_date || ''
          )
        );

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(
        b.uploaded_at || ''
      ).localeCompare(
        String(
          a.uploaded_at || ''
        )
      );
    }
  );

  renderHistory();

  if (!uploads.length) {
    rows = [];
    activeUpload = null;

    populateSnapshotSelector();
    populateCompareSelector();
    makeFilters();
    render();

    toast(
      'No outstanding snapshot uploaded yet.'
    );

    return;
  }

  activeUpload =
    uploads[0];

  populateSnapshotSelector();

  await loadSnapshot(
    activeUpload.id
  );
}

/* =========================================================
   CSV UPLOAD
========================================================= */

function parseCsv(file) {
  return new Promise(
    (resolve, reject) => {
      Papa.parse(
        file,
        {
          header: true,
          skipEmptyLines: true,
          transformHeader:
            header =>
              String(header)
                .trim(),

          complete(result) {
            if (
              result.errors &&
              result.errors.length
            ) {
              const serious =
                result.errors.find(
                  error =>
                    error.type !==
                    'FieldMismatch'
                );

              if (serious) {
                reject(
                  new Error(
                    serious.message
                  )
                );

                return;
              }
            }

            resolve(
              result.data || []
            );
          },

          error(error) {
            reject(error);
          }
        }
      );
    }
  );
}

/* =========================================================
   MAP CSV TO DATABASE

   IMPORTANT:
   CSV values are stored DIRECTLY.

   CSV 15  -> days_15
   CSV 30  -> days_30
   CSV 45  -> days_45
   CSV 60  -> days_60
   CSV 75  -> days_75
   CSV 90  -> days_90
   CSV 120 -> days_120
   CSV 150 -> days_150

   No subtraction.
========================================================= */

function mapCsvRows(csvRows) {
  return csvRows.map(row => ({
    party:
      String(
        row.Party ?? ''
      ).trim(),

    balance:
      num(row.Balance),

    days_15:
      num(row['15']),

    days_30:
      num(row['30']),

    days_45:
      num(row['45']),

    days_60:
      num(row['60']),

    days_75:
      num(row['75']),

    days_90:
      num(row['90']),

    days_120:
      num(row['120']),

    days_150:
      num(row['150']),

    pdc:
      num(row.PDC),

    sm:
      String(
        row.SM ?? ''
      ).trim(),

    grp_name:
      String(
        row.GrpName ?? ''
      ).trim(),

    division:
      String(
        row.Division ?? ''
      ).trim(),

    area:
      String(
        row.Area ?? ''
      ).trim(),

    order_type:
      String(
        row.Order ?? ''
      ).trim(),

    city:
      String(
        row.City ?? ''
      ).trim(),

    pincode:
      String(
        row.Pincode ?? ''
      ).trim()
  }));
}

/* =========================================================
   UPLOAD OUTSTANDING
========================================================= */

async function uploadOutstanding(
  file,
  outstandingDate
) {
  if (!file) {
    throw new Error(
      'Please select CSV file.'
    );
  }

  if (!outstandingDate) {
    throw new Error(
      'Please select outstanding date.'
    );
  }

  toast(
    'Reading CSV...',
    true
  );

  const csvRows =
    await parseCsv(file);

  if (!csvRows.length) {
    throw new Error(
      'CSV contains no data.'
    );
  }

  const mappedRows =
    mapCsvRows(csvRows);

  const requiredCheck =
    mappedRows.filter(
      row =>
        row.party
    );

  if (!requiredCheck.length) {
    throw new Error(
      'Party column not found or CSV has no valid Party rows.'
    );
  }

  /*
    Upload exact source values.
  */

  const payload =
    requiredCheck;

  toast(
    `Uploading ${payload.length.toLocaleString(
      'en-IN'
    )} rows...`,
    true
  );

  const { data, error } =
    await sb.rpc(
      'raj_outstanding_upload_json',
      authArgs({
        p_outstanding_date:
          outstandingDate,

        p_file_name:
          file.name,

        p_rows:
          payload
      })
    );

  if (error) {
    throw new Error(
      'Upload failed: ' +
      error.message
    );
  }

  toast(
    'Upload completed. Refreshing dashboard...',
    true
  );

  snapshotCache.clear();

  await load();

  toast(
    'Outstanding uploaded successfully.'
  );

  return data;
}

/* =========================================================
   UPLOAD MODAL HELPERS
========================================================= */

function openUploadModal() {
  const modal =
    $('#uploadModal');

  if (!modal) {
    /*
      Fallback:
      If HTML uses direct file/date controls,
      click the file input.
    */

    $('#csvFile')?.click();
    return;
  }

  modal.classList.add(
    'open'
  );

  modal.style.display =
    'flex';

  const date =
    $('#outstandingDate');

  if (
    date &&
    !date.value
  ) {
    date.value =
      new Date()
        .toISOString()
        .slice(0, 10);
  }
}

function closeUploadModal() {
  const modal =
    $('#uploadModal');

  if (!modal) return;

  modal.classList.remove(
    'open'
  );

  modal.style.display =
    'none';
}

/* =========================================================
   CLEAR ALL FILTERS
========================================================= */

function clearAllFilters() {
  filterMap.forEach(
    ([key]) =>
      filterSelections[key]
        .clear()
  );

  document
    .querySelectorAll(
      '.ms-search'
    )
    .forEach(
      input =>
        input.value = ''
    );

  detailPage = 1;

  refreshFilters();

  render();
}

/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  /* SNAPSHOT CHANGE */

  if ($('#snapshotSelect')) {
    $('#snapshotSelect')
      .onchange =
        async event => {
          try {
            await loadSnapshot(
              event.target.value
            );
          } catch (error) {
            fatal(error);
          }
        };
  }

  /* COMPARISON CHANGE */

  if (
    $('#compareSnapshotSelect')
  ) {
    $('#compareSnapshotSelect')
      .onchange =
        () => {
          renderCompare(
            metrics(
              filtered()
            )
          ).catch(
            error =>
              console.error(
                error
              )
          );
        };
  }

  /* CUSTOMER SEARCH */

  if ($('#detailSearch')) {
    $('#detailSearch')
      .oninput =
        () => {
          detailPage = 1;

          renderDetails(
            filtered()
          );
        };
  }

  /* PREVIOUS PAGE */

  if ($('#prevPage')) {
    $('#prevPage')
      .onclick =
        () => {
          if (
            detailPage > 1
          ) {
            detailPage--;

            renderDetails(
              filtered()
            );
          }
        };
  }

  /* NEXT PAGE */

  if ($('#nextPage')) {
    $('#nextPage')
      .onclick =
        () => {
          detailPage++;

          renderDetails(
            filtered()
          );
        };
  }

  /* CLEAR FILTERS */

  const clearButton =
    $('#resetBtn') ||
    $('#clearFilters') ||
    $('#clearAllFilters');

  if (clearButton) {
    clearButton.onclick =
      clearAllFilters;
  }

  /* UPLOAD BUTTON */

  const uploadButton =
    $('#uploadBtn') ||
    $('#uploadOutstandingBtn');

  if (uploadButton) {
    uploadButton.onclick =
      openUploadModal;
  }

  if ($('#uploadBtn2')) { $('#uploadBtn2').onclick = openUploadModal; }
  if ($('#refreshBtn')) { $('#refreshBtn').onclick = () => load().catch(fatal); }
  if ($('#logoutBtn')) { $('#logoutBtn').onclick = () => { localStorage.removeItem(TOKEN); localStorage.removeItem(USER); location.href='index.html'; }; }

  /* CLOSE UPLOAD MODAL */

  const closeButton =
    $('#closeUploadModal') ||
    $('#cancelUpload');

  if (closeButton) {
    closeButton.onclick =
      closeUploadModal;
  }

  /* SUBMIT UPLOAD */

  const uploadForm =
    $('#uploadForm');

  if (uploadForm) {
    uploadForm.onsubmit =
      async event => {
        event.preventDefault();

        const file =
          $('#csvFile')
            ?.files?.[0];

        const date =
          $('#outstandingDate')
            ?.value;

        try {
          await uploadOutstanding(
            file,
            date
          );

          closeUploadModal();

          uploadForm.reset();

        } catch (error) {
          fatal(error);
        }
      };
  }

  /*
    Some versions of HTML may have
    a separate upload confirm button.
  */

  const confirmUpload =
    $('#confirmUpload');

  if (
    confirmUpload &&
    !uploadForm
  ) {
    confirmUpload.onclick =
      async () => {
        const file =
          $('#csvFile')
            ?.files?.[0];

        const date =
          $('#outstandingDate')
            ?.value;

        try {
          await uploadOutstanding(
            file,
            date
          );

          closeUploadModal();

        } catch (error) {
          fatal(error);
        }
      };
  }

  /* ESC CLOSE */

  document.addEventListener(
    'keydown',
    event => {
      if (
        event.key ===
        'Escape'
      ) {
        document
          .querySelectorAll(
            '.ms.open'
          )
          .forEach(
            box =>
              box.classList
                .remove('open')
          );

        closeUploadModal();
      }
    }
  );
}

/* =========================================================
   INITIALIZE
========================================================= */

async function init() {
  try {
    /*
      Check required libraries before
      creating Supabase client.
    */

    if (
      typeof window.supabase ===
      'undefined'
    ) {
      throw new Error(
        'Supabase library is not loaded.'
      );
    }

    if (
      typeof window.RAJ_CONFIG ===
      'undefined'
    ) {
      throw new Error(
        'config.js / RAJ_CONFIG is not loaded.'
      );
    }

    if (
      typeof window.Chart ===
      'undefined'
    ) {
      throw new Error(
        'Chart.js is not loaded.'
      );
    }

    if (
      typeof window.Papa ===
      'undefined'
    ) {
      throw new Error(
        'PapaParse is not loaded.'
      );
    }

    const key =
      RAJ_CONFIG
        .supabasePublishableKey ||
      RAJ_CONFIG
        .supabaseAnonKey;

    if (
      !RAJ_CONFIG.supabaseUrl ||
      !key
    ) {
      throw new Error(
        'Supabase configuration is incomplete.'
      );
    }

    sb =
      window.supabase
        .createClient(
          RAJ_CONFIG
            .supabaseUrl,
          key
        );

    bindEvents();
    initOutstandingDrawer();

    const ok =
      await guard();

    if (!ok) {
      return;
    }

    await load();

  } catch (error) {
    fatal(error);
  }
}

/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    init
  );
} else {
  init();
}

})();
