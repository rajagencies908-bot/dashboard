/* =========================================================
   OUTSTANDING DASHBOARD
   FINAL VERSION
   Part 1 of 3
========================================================= */

const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);

/* =========================================================
   SETTINGS
========================================================= */

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

const RPC_PAGE_SIZE = 1000;
const DETAIL_PAGE_SIZE = 50;

/* =========================================================
   STATE
========================================================= */

let rows = [];
let uploads = [];
let activeUpload = null;

let charts = {};

let detailPage = 1;

let detailSort = {
  key: 'party',
  dir: 'asc'
};

let historySort = {
  key: 'outstanding_date',
  dir: 'desc'
};

/*
  Multiple selected values for every filter.
*/
let filterSelections = {};

/*
  Cache comparison snapshots so the same snapshot
  does not need to download again on every filter click.
*/
const snapshotCache = new Map();

/*
  Used to stop an old comparison request from
  overwriting a newer comparison.
*/
let comparisonRequestId = 0;

/* =========================================================
   DOM / BASIC HELPERS
========================================================= */

const $ = selector => document.querySelector(selector);

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, '')
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value) {
  return '₹ ' +
    Math.round(num(value))
      .toLocaleString('en-IN');
}

function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
}

/* =========================================================
   STATUS / TOAST

   This is intentionally used throughout loading.
   If anything fails, the page itself will show the error.
========================================================= */

function toast(message, stay = false) {
  const element = $('#toast');

  console.log('[Outstanding]', message);

  if (!element) {
    return;
  }

  element.textContent = message;
  element.style.display = 'block';

  clearTimeout(toast.timer);

  if (!stay) {
    toast.timer = setTimeout(() => {
      element.style.display = 'none';
    }, 4000);
  }
}

function showFatal(error) {
  console.error(
    '[Outstanding Dashboard Error]',
    error
  );

  const message =
    error?.message ||
    String(error) ||
    'Unknown dashboard error';

  toast(
    'Dashboard error: ' + message,
    true
  );
}

/* =========================================================
   AUTH / RPC
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

async function rpc(functionName, args = {}) {
  const { data, error } = await sb.rpc(
    functionName,
    authArgs(args)
  );

  if (error) {
    throw new Error(
      `${functionName}: ${error.message}`
    );
  }

  return data;
}

/* =========================================================
   SESSION CHECK
========================================================= */

async function guard() {
  toast('Checking session...', true);

  const token =
    localStorage.getItem(TOKEN);

  if (!token) {
    location.href = 'index.html';
    return false;
  }

  const { data, error } = await sb.rpc(
    'raj_app_validate_session',
    authArgs()
  );

  if (error) {
    throw new Error(
      'Session check failed: ' +
      error.message
    );
  }

  if (
    !data ||
    data.success !== true
  ) {
    location.href = 'index.html';
    return false;
  }

  toast('Session OK. Loading dashboard...', true);

  return true;
}

/* =========================================================
   GET ALL ROWS - SERVER PAGINATION

   Supabase function:
   raj_outstanding_get_rows(
     p_session_token,
     p_device_id,
     p_upload_id,
     p_offset,
     p_limit
   )

   4052 rows will load:
   0-999
   1000-1999
   2000-2999
   3000-3999
   4000-4051
========================================================= */

async function getAllOutstandingRows(
  uploadId,
  statusPrefix = 'Loading'
) {
  const allRows = [];

  let offset = 0;
  let pageNumber = 1;

  while (true) {
    toast(
      `${statusPrefix} rows... ${allRows.length.toLocaleString('en-IN')} loaded`,
      true
    );

    const { data, error } = await sb.rpc(
      'raj_outstanding_get_rows',
      authArgs({
        p_upload_id: uploadId,
        p_offset: offset,
        p_limit: RPC_PAGE_SIZE
      })
    );

    if (error) {
      throw new Error(
        'Outstanding rows load failed: ' +
        error.message
      );
    }

    const page =
      Array.isArray(data)
        ? data
        : [];

    allRows.push(...page);

    console.log(
      `[Outstanding] Page ${pageNumber}:`,
      page.length,
      'Total:',
      allRows.length
    );

    if (page.length < RPC_PAGE_SIZE) {
      break;
    }

    offset += RPC_PAGE_SIZE;
    pageNumber += 1;

    if (offset > 100000) {
      throw new Error(
        'Outstanding pagination safety limit reached.'
      );
    }
  }

  console.log(
    '[Outstanding] Final row count:',
    allRows.length
  );

  return allRows;
}

/* =========================================================
   AGEING LOGIC

   Source CSV ageing columns are cumulative.

   0-15    = Balance - 15 - PDC
   16-30   = 15 - 30
   31-45   = 30 - 45
   46-60   = 45 - 60
   61-75   = 60 - 75
   76-90   = 75 - 90
   91-120  = 90 - 120
   121-150 = 120 - 150
   >150    = 150
   PDC     = PDC
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
  ['>150', 'over150'],
  ['PDC', 'pdc']
];

function bucket(row) {
  return {
    days_15: Math.max(
      0,
      num(row.balance) -
      num(row.days_15) -
      num(row.pdc)
    ),

    days_30: Math.max(
      0,
      num(row.days_15) -
      num(row.days_30)
    ),

    days_45: Math.max(
      0,
      num(row.days_30) -
      num(row.days_45)
    ),

    days_60: Math.max(
      0,
      num(row.days_45) -
      num(row.days_60)
    ),

    days_75: Math.max(
      0,
      num(row.days_60) -
      num(row.days_75)
    ),

    days_90: Math.max(
      0,
      num(row.days_75) -
      num(row.days_90)
    ),

    days_120: Math.max(
      0,
      num(row.days_90) -
      num(row.days_120)
    ),

    days_150: Math.max(
      0,
      num(row.days_120) -
      num(row.days_150)
    ),

    over150: Math.max(
      0,
      num(row.days_150)
    ),

    pdc: Math.max(
      0,
      num(row.pdc)
    )
  };
}

/* =========================================================
   FILTER DEFINITIONS
========================================================= */

const filterMap = [
  ['party', 'Customer / Party'],
  ['sm', 'SM'],
  ['grp_name', 'GrpName'],
  ['division', 'Division'],
  ['area', 'Area'],
  ['order_type', 'OD / Order'],
  ['city', 'City'],
  ['pincode', 'Pincode']
];

filterMap.forEach(([key]) => {
  filterSelections[key] = new Set();
});

/* =========================================================
   FILTER MATCHING

   IMPORTANT:
   This accepts a sourceData argument so the SAME selections
   can be applied to current and comparison snapshots.
========================================================= */

function rowMatchesSelections(
  row,
  ignoreKey = null
) {
  return filterMap.every(([key]) => {
    if (key === ignoreKey) {
      return true;
    }

    const selected =
      filterSelections[key];

    if (!selected.size) {
      return true;
    }

    const value =
      String(row[key] ?? '').trim();

    return selected.has(value);
  });
}

function filtered(sourceData = rows) {
  return sourceData.filter(row =>
    rowMatchesSelections(row)
  );
}

/* =========================================================
   CASCADING FILTER OPTIONS

   For a particular filter, all OTHER selected filters
   are applied.

   Example:
   SM = Bh
   GrpName = Sundry Debtors (Both)

   Party options will contain only parties matching both.
========================================================= */

function availableValues(
  key,
  sourceData = rows
) {
  return [
    ...new Set(
      sourceData
        .filter(row =>
          rowMatchesSelections(
            row,
            key
          )
        )
        .map(row =>
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

/*
   If another filter selection makes an existing
   selection impossible, remove that selection.
*/
function pruneSelections() {
  let changed = true;
  let passes = 0;

  while (
    changed &&
    passes < 12
  ) {
    changed = false;
    passes += 1;

    for (
      const [key] of filterMap
    ) {
      const available =
        new Set(
          availableValues(key)
        );

      for (
        const selectedValue
        of [...filterSelections[key]]
      ) {
        if (
          !available.has(
            selectedValue
          )
        ) {
          filterSelections[key]
            .delete(selectedValue);

          changed = true;
        }
      }
    }
  }
}

function filterButtonText(
  key,
  label
) {
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

/* =========================================================
   MULTI SELECT FILTER UI
========================================================= */

function renderFilterOptions(key) {
  const component =
    document.querySelector(
      `.ms[data-key="${key}"]`
    );

  if (!component) {
    return;
  }

  const definition =
    filterMap.find(
      item => item[0] === key
    );

  if (!definition) {
    return;
  }

  const label = definition[1];

  const searchInput =
    component.querySelector(
      '.ms-search'
    );

  const search =
    String(
      searchInput?.value || ''
    )
      .trim()
      .toLowerCase();

  const values =
    availableValues(key)
      .filter(value =>
        value
          .toLowerCase()
          .includes(search)
      );

  const options =
    component.querySelector(
      '.ms-options'
    );

  if (!options) {
    return;
  }

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
            <span>${esc(value)}</span>
          </label>
        `).join('')
      : `
          <div class="ms-empty">
            No matching options
          </div>
        `;

  const trigger =
    component.querySelector(
      '.ms-trigger'
    );

  if (trigger) {
    trigger.textContent =
      filterButtonText(
        key,
        label
      );
  }

  options
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(checkbox => {
      checkbox.onchange = () => {
        const value =
          checkbox.value;

        if (checkbox.checked) {
          filterSelections[key]
            .add(value);
        } else {
          filterSelections[key]
            .delete(value);
        }

        filtersChanged();
      };
    });
}

function refreshAllFilters() {
  filterMap.forEach(([key]) => {
    renderFilterOptions(key);
  });
}

function filtersChanged() {
  pruneSelections();

  detailPage = 1;

  refreshAllFilters();

  render();
}

/* =========================================================
   CREATE FILTER COMPONENTS
========================================================= */

function makeFilters() {
  const container =
    $('#filters');

  if (!container) {
    return;
  }

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
                filterButtonText(
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

              <div class="ms-options">
              </div>

            </div>

          </div>

        </div>
      `
    ).join('');

  container
    .querySelectorAll('.ms')
    .forEach(component => {
      const key =
        component.dataset.key;

      const trigger =
        component.querySelector(
          '.ms-trigger'
        );

      const menu =
        component.querySelector(
          '.ms-menu'
        );

      const search =
        component.querySelector(
          '.ms-search'
        );

      const selectVisible =
        component.querySelector(
          '[data-act="all"]'
        );

      const clear =
        component.querySelector(
          '[data-act="clear"]'
        );

      trigger.onclick = event => {
        event.stopPropagation();

        document
          .querySelectorAll(
            '.ms.open'
          )
          .forEach(openComponent => {
            if (
              openComponent !==
              component
            ) {
              openComponent
                .classList
                .remove('open');
            }
          });

        component
          .classList
          .toggle('open');

        renderFilterOptions(key);

        if (
          component.classList
            .contains('open')
        ) {
          setTimeout(
            () => search?.focus(),
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

      clear.onclick = () => {
        filterSelections[key]
          .clear();

        search.value = '';

        filtersChanged();
      };

      selectVisible.onclick = () => {
        const query =
          String(
            search.value || ''
          )
            .trim()
            .toLowerCase();

        availableValues(key)
          .filter(value =>
            value
              .toLowerCase()
              .includes(query)
          )
          .forEach(value =>
            filterSelections[key]
              .add(value)
          );

        filtersChanged();
      };
    });

  refreshAllFilters();
}

/*
  Clicking outside closes open multi-select.
*/
document.addEventListener(
  'click',
  () => {
    document
      .querySelectorAll('.ms.open')
      .forEach(component =>
        component
          .classList
          .remove('open')
      );
  }
);

/* =========================================================
   METRICS
========================================================= */

function sum(data, key) {
  return data.reduce(
    (total, row) =>
      total + num(row[key]),
    0
  );
}

function metrics(data) {
  const bucketSums = {};

  bucketDefs.forEach(
    ([, key]) => {
      bucketSums[key] =
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
          .map(row =>
            String(
              row.party ?? ''
            ).trim()
          )
          .filter(Boolean)
      ).size,

    pdc:
      sum(data, 'pdc'),

    /*
      CSV 90 and 150 are cumulative overdue columns.
    */
    over90:
      sum(data, 'days_90'),

    over150:
      sum(data, 'days_150'),

    bs:
      bucketSums
  };
}





/* =========================================================
   OUTSTANDING DASHBOARD
   FINAL VERSION
   Part 1 of 3
========================================================= */

const { createClient } = supabase;

const sb = createClient(
  RAJ_CONFIG.supabaseUrl,
  RAJ_CONFIG.supabasePublishableKey
);

/* =========================================================
   SETTINGS
========================================================= */

const TOKEN = 'raj_dashboard_session_token';
const DEVICE = 'raj_dashboard_device_id';
const USER = 'raj_dashboard_user';

const RPC_PAGE_SIZE = 1000;
const DETAIL_PAGE_SIZE = 50;

/* =========================================================
   STATE
========================================================= */

let rows = [];
let uploads = [];
let activeUpload = null;

let charts = {};

let detailPage = 1;

let detailSort = {
  key: 'party',
  dir: 'asc'
};

let historySort = {
  key: 'outstanding_date',
  dir: 'desc'
};

/*
  Multiple selected values for every filter.
*/
let filterSelections = {};

/*
  Cache comparison snapshots so the same snapshot
  does not need to download again on every filter click.
*/
const snapshotCache = new Map();

/*
  Used to stop an old comparison request from
  overwriting a newer comparison.
*/
let comparisonRequestId = 0;

/* =========================================================
   DOM / BASIC HELPERS
========================================================= */

const $ = selector => document.querySelector(selector);

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const parsed = Number(
    String(value)
      .replace(/,/g, '')
      .trim()
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value) {
  return '₹ ' +
    Math.round(num(value))
      .toLocaleString('en-IN');
}

function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
}

/* =========================================================
   STATUS / TOAST

   This is intentionally used throughout loading.
   If anything fails, the page itself will show the error.
========================================================= */

function toast(message, stay = false) {
  const element = $('#toast');

  console.log('[Outstanding]', message);

  if (!element) {
    return;
  }

  element.textContent = message;
  element.style.display = 'block';

  clearTimeout(toast.timer);

  if (!stay) {
    toast.timer = setTimeout(() => {
      element.style.display = 'none';
    }, 4000);
  }
}

function showFatal(error) {
  console.error(
    '[Outstanding Dashboard Error]',
    error
  );

  const message =
    error?.message ||
    String(error) ||
    'Unknown dashboard error';

  toast(
    'Dashboard error: ' + message,
    true
  );
}

/* =========================================================
   AUTH / RPC
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

async function rpc(functionName, args = {}) {
  const { data, error } = await sb.rpc(
    functionName,
    authArgs(args)
  );

  if (error) {
    throw new Error(
      `${functionName}: ${error.message}`
    );
  }

  return data;
}

/* =========================================================
   SESSION CHECK
========================================================= */

async function guard() {
  toast('Checking session...', true);

  const token =
    localStorage.getItem(TOKEN);

  if (!token) {
    location.href = 'index.html';
    return false;
  }

  const { data, error } = await sb.rpc(
    'raj_app_validate_session',
    authArgs()
  );

  if (error) {
    throw new Error(
      'Session check failed: ' +
      error.message
    );
  }

  if (
    !data ||
    data.success !== true
  ) {
    location.href = 'index.html';
    return false;
  }

  toast('Session OK. Loading dashboard...', true);

  return true;
}

/* =========================================================
   GET ALL ROWS - SERVER PAGINATION

   Supabase function:
   raj_outstanding_get_rows(
     p_session_token,
     p_device_id,
     p_upload_id,
     p_offset,
     p_limit
   )

   4052 rows will load:
   0-999
   1000-1999
   2000-2999
   3000-3999
   4000-4051
========================================================= */

async function getAllOutstandingRows(
  uploadId,
  statusPrefix = 'Loading'
) {
  const allRows = [];

  let offset = 0;
  let pageNumber = 1;

  while (true) {
    toast(
      `${statusPrefix} rows... ${allRows.length.toLocaleString('en-IN')} loaded`,
      true
    );

    const { data, error } = await sb.rpc(
      'raj_outstanding_get_rows',
      authArgs({
        p_upload_id: uploadId,
        p_offset: offset,
        p_limit: RPC_PAGE_SIZE
      })
    );

    if (error) {
      throw new Error(
        'Outstanding rows load failed: ' +
        error.message
      );
    }

    const page =
      Array.isArray(data)
        ? data
        : [];

    allRows.push(...page);

    console.log(
      `[Outstanding] Page ${pageNumber}:`,
      page.length,
      'Total:',
      allRows.length
    );

    if (page.length < RPC_PAGE_SIZE) {
      break;
    }

    offset += RPC_PAGE_SIZE;
    pageNumber += 1;

    if (offset > 100000) {
      throw new Error(
        'Outstanding pagination safety limit reached.'
      );
    }
  }

  console.log(
    '[Outstanding] Final row count:',
    allRows.length
  );

  return allRows;
}

/* =========================================================
   AGEING LOGIC

   Source CSV ageing columns are cumulative.

   0-15    = Balance - 15 - PDC
   16-30   = 15 - 30
   31-45   = 30 - 45
   46-60   = 45 - 60
   61-75   = 60 - 75
   76-90   = 75 - 90
   91-120  = 90 - 120
   121-150 = 120 - 150
   >150    = 150
   PDC     = PDC
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
  ['>150', 'over150'],
  ['PDC', 'pdc']
];

function bucket(row) {
  return {
    days_15: Math.max(
      0,
      num(row.balance) -
      num(row.days_15) -
      num(row.pdc)
    ),

    days_30: Math.max(
      0,
      num(row.days_15) -
      num(row.days_30)
    ),

    days_45: Math.max(
      0,
      num(row.days_30) -
      num(row.days_45)
    ),

    days_60: Math.max(
      0,
      num(row.days_45) -
      num(row.days_60)
    ),

    days_75: Math.max(
      0,
      num(row.days_60) -
      num(row.days_75)
    ),

    days_90: Math.max(
      0,
      num(row.days_75) -
      num(row.days_90)
    ),

    days_120: Math.max(
      0,
      num(row.days_90) -
      num(row.days_120)
    ),

    days_150: Math.max(
      0,
      num(row.days_120) -
      num(row.days_150)
    ),

    over150: Math.max(
      0,
      num(row.days_150)
    ),

    pdc: Math.max(
      0,
      num(row.pdc)
    )
  };
}

/* =========================================================
   FILTER DEFINITIONS
========================================================= */

const filterMap = [
  ['party', 'Customer / Party'],
  ['sm', 'SM'],
  ['grp_name', 'GrpName'],
  ['division', 'Division'],
  ['area', 'Area'],
  ['order_type', 'OD / Order'],
  ['city', 'City'],
  ['pincode', 'Pincode']
];

filterMap.forEach(([key]) => {
  filterSelections[key] = new Set();
});

/* =========================================================
   FILTER MATCHING

   IMPORTANT:
   This accepts a sourceData argument so the SAME selections
   can be applied to current and comparison snapshots.
========================================================= */

function rowMatchesSelections(
  row,
  ignoreKey = null
) {
  return filterMap.every(([key]) => {
    if (key === ignoreKey) {
      return true;
    }

    const selected =
      filterSelections[key];

    if (!selected.size) {
      return true;
    }

    const value =
      String(row[key] ?? '').trim();

    return selected.has(value);
  });
}

function filtered(sourceData = rows) {
  return sourceData.filter(row =>
    rowMatchesSelections(row)
  );
}

/* =========================================================
   CASCADING FILTER OPTIONS

   For a particular filter, all OTHER selected filters
   are applied.

   Example:
   SM = Bh
   GrpName = Sundry Debtors (Both)

   Party options will contain only parties matching both.
========================================================= */

function availableValues(
  key,
  sourceData = rows
) {
  return [
    ...new Set(
      sourceData
        .filter(row =>
          rowMatchesSelections(
            row,
            key
          )
        )
        .map(row =>
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

/*
   If another filter selection makes an existing
   selection impossible, remove that selection.
*/
function pruneSelections() {
  let changed = true;
  let passes = 0;

  while (
    changed &&
    passes < 12
  ) {
    changed = false;
    passes += 1;

    for (
      const [key] of filterMap
    ) {
      const available =
        new Set(
          availableValues(key)
        );

      for (
        const selectedValue
        of [...filterSelections[key]]
      ) {
        if (
          !available.has(
            selectedValue
          )
        ) {
          filterSelections[key]
            .delete(selectedValue);

          changed = true;
        }
      }
    }
  }
}

function filterButtonText(
  key,
  label
) {
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

/* =========================================================
   MULTI SELECT FILTER UI
========================================================= */

function renderFilterOptions(key) {
  const component =
    document.querySelector(
      `.ms[data-key="${key}"]`
    );

  if (!component) {
    return;
  }

  const definition =
    filterMap.find(
      item => item[0] === key
    );

  if (!definition) {
    return;
  }

  const label = definition[1];

  const searchInput =
    component.querySelector(
      '.ms-search'
    );

  const search =
    String(
      searchInput?.value || ''
    )
      .trim()
      .toLowerCase();

  const values =
    availableValues(key)
      .filter(value =>
        value
          .toLowerCase()
          .includes(search)
      );

  const options =
    component.querySelector(
      '.ms-options'
    );

  if (!options) {
    return;
  }

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
            <span>${esc(value)}</span>
          </label>
        `).join('')
      : `
          <div class="ms-empty">
            No matching options
          </div>
        `;

  const trigger =
    component.querySelector(
      '.ms-trigger'
    );

  if (trigger) {
    trigger.textContent =
      filterButtonText(
        key,
        label
      );
  }

  options
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(checkbox => {
      checkbox.onchange = () => {
        const value =
          checkbox.value;

        if (checkbox.checked) {
          filterSelections[key]
            .add(value);
        } else {
          filterSelections[key]
            .delete(value);
        }

        filtersChanged();
      };
    });
}

function refreshAllFilters() {
  filterMap.forEach(([key]) => {
    renderFilterOptions(key);
  });
}

function filtersChanged() {
  pruneSelections();

  detailPage = 1;

  refreshAllFilters();

  render();
}

/* =========================================================
   CREATE FILTER COMPONENTS
========================================================= */

function makeFilters() {
  const container =
    $('#filters');

  if (!container) {
    return;
  }

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
                filterButtonText(
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

              <div class="ms-options">
              </div>

            </div>

          </div>

        </div>
      `
    ).join('');

  container
    .querySelectorAll('.ms')
    .forEach(component => {
      const key =
        component.dataset.key;

      const trigger =
        component.querySelector(
          '.ms-trigger'
        );

      const menu =
        component.querySelector(
          '.ms-menu'
        );

      const search =
        component.querySelector(
          '.ms-search'
        );

      const selectVisible =
        component.querySelector(
          '[data-act="all"]'
        );

      const clear =
        component.querySelector(
          '[data-act="clear"]'
        );

      trigger.onclick = event => {
        event.stopPropagation();

        document
          .querySelectorAll(
            '.ms.open'
          )
          .forEach(openComponent => {
            if (
              openComponent !==
              component
            ) {
              openComponent
                .classList
                .remove('open');
            }
          });

        component
          .classList
          .toggle('open');

        renderFilterOptions(key);

        if (
          component.classList
            .contains('open')
        ) {
          setTimeout(
            () => search?.focus(),
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

      clear.onclick = () => {
        filterSelections[key]
          .clear();

        search.value = '';

        filtersChanged();
      };

      selectVisible.onclick = () => {
        const query =
          String(
            search.value || ''
          )
            .trim()
            .toLowerCase();

        availableValues(key)
          .filter(value =>
            value
              .toLowerCase()
              .includes(query)
          )
          .forEach(value =>
            filterSelections[key]
              .add(value)
          );

        filtersChanged();
      };
    });

  refreshAllFilters();
}

/*
  Clicking outside closes open multi-select.
*/
document.addEventListener(
  'click',
  () => {
    document
      .querySelectorAll('.ms.open')
      .forEach(component =>
        component
          .classList
          .remove('open')
      );
  }
);

/* =========================================================
   METRICS
========================================================= */

function sum(data, key) {
  return data.reduce(
    (total, row) =>
      total + num(row[key]),
    0
  );
}

function metrics(data) {
  const bucketSums = {};

  bucketDefs.forEach(
    ([, key]) => {
      bucketSums[key] =
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
          .map(row =>
            String(
              row.party ?? ''
            ).trim()
          )
          .filter(Boolean)
      ).size,

    pdc:
      sum(data, 'pdc'),

    /*
      CSV 90 and 150 are cumulative overdue columns.
    */
    over90:
      sum(data, 'days_90'),

    over150:
      sum(data, 'days_150'),

    bs:
      bucketSums
  };
}




/* =========================================================
   CHART HELPERS
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

  const canvas = $(selector);

  if (!canvas) {
    return;
  }

  charts[selector] = new Chart(
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
              label: context => {
                const value =
                  context.raw ?? 0;

                const prefix =
                  context.dataset.label
                    ? context.dataset.label + ': '
                    : '';

                /*
                  Customer count chart should not
                  display values as currency.
                */
                if (options.countChart) {
                  return (
                    prefix +
                    Number(value)
                      .toLocaleString('en-IN')
                  );
                }

                return prefix + money(value);
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

                  grid: {
                    color: '#eef1f7'
                  },

                  ticks: {
                    callback: value => {
                      const n =
                        Number(value);

                      if (options.countChart) {
                        return n
                          .toLocaleString('en-IN');
                      }

                      if (
                        Math.abs(n) >=
                        10000000
                      ) {
                        return (
                          n / 10000000
                        ).toFixed(1) + ' Cr';
                      }

                      if (
                        Math.abs(n) >=
                        100000
                      ) {
                        return (
                          n / 100000
                        ).toFixed(1) + ' L';
                      }

                      if (
                        Math.abs(n) >=
                        1000
                      ) {
                        return (
                          n / 1000
                        ).toFixed(0) + ' K';
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

function simpleTable(
  items,
  columns
) {
  return `
    <table>

      <thead>
        <tr>
          ${columns.map(column => `
            <th
              class="${
                column.num
                  ? 'num'
                  : ''
              }"
            >
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
                        <td
                          class="${
                            column.num
                              ? 'num'
                              : ''
                          }"
                        >
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
   SORTING
========================================================= */

const numericFields =
  new Set([
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

function compareValues(
  a,
  b,
  key
) {
  const aValue =
    a?.[key] ?? '';

  const bValue =
    b?.[key] ?? '';

  if (
    numericFields.has(key)
  ) {
    return (
      num(aValue) -
      num(bValue)
    );
  }

  return String(aValue)
    .localeCompare(
      String(bValue),
      undefined,
      {
        numeric: true,
        sensitivity: 'base'
      }
    );
}

function sortArrow(
  sort,
  key
) {
  if (
    sort.key !== key
  ) {
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
    list = list.filter(
      row =>
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

  list.sort(
    (a, b) => {
      const result =
        compareValues(
          a,
          b,
          detailSort.key
        );

      return (
        detailSort.dir === 'asc'
          ? result
          : -result
      );
    }
  );

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
      Math.max(
        1,
        detailPage
      ),
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
    ['days_15', '>15', true],
    ['days_30', '>30', true],
    ['days_45', '>45', true],
    ['days_60', '>60', true],
    ['days_75', '>75', true],
    ['days_90', '>90', true],
    ['days_120', '>120', true],
    ['days_150', '>150', true],
    ['pdc', 'PDC', true],
    ['sm', 'SM', false],
    ['grp_name', 'GrpName', false],
    ['division', 'Division', false],
    ['area', 'Area', false],
    ['order_type', 'OD / Order', false],
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
                class="
                  sortable
                  ${numeric ? 'num' : ''}
                "
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

            ? pageRows.map(
                row => `
                  <tr>
                    ${columns.map(
                      ([key, , numeric]) => `
                        <td
                          class="${
                            numeric
                              ? 'num'
                              : ''
                          }"
                        >
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
                `
              ).join('')

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
        `${list.length.toLocaleString('en-IN')} rows`;
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
    .forEach(heading => {
      heading.onclick = () => {
        const key =
          heading.dataset.detailSort;

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
   KPI + CHARTS + TOP 5
========================================================= */

function render() {
  const data =
    filtered();

  const currentMetrics =
    metrics(data);

  /* =========================
     KPI
  ========================= */

  const kpis =
    $('#kpis');

  if (kpis) {
    const cards = [
      [
        'Total Outstanding',
        money(
          currentMetrics.total
        )
      ],

      [
        'Total Customers',
        currentMetrics.customers
          .toLocaleString('en-IN')
      ],

      [
        'PDC Amount',
        money(
          currentMetrics.pdc
        )
      ],

      [
        'Over 90 Days',
        money(
          currentMetrics.over90
        )
      ],

      [
        'Over 150 Days',
        money(
          currentMetrics.over150
        )
      ]
    ];

    kpis.innerHTML =
      cards.map(
        ([label, value]) => `
          <article class="kpi">

            <span>
              ${esc(label)}
            </span>

            <strong>
              ${esc(value)}
            </strong>

            <small>
              Current snapshot
            </small>

          </article>
        `
      ).join('');
  }

  /* =========================
     AGEING CHART
  ========================= */

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
        label: 'Amount',
        data: ageingValues,
        borderRadius: 6
      }
    ]
  );

  /* =========================
     BREAKUP DONUT
  ========================= */

  draw(
    '#donutChart',
    'doughnut',
    ageingLabels,
    [
      {
        label: 'Amount',
        data: ageingValues,
        borderWidth: 0
      }
    ],
    {
      legend: true
    }
  );

  /* =========================
     AMOUNT RANGE
  ========================= */

  const ranges = [
    {
      label: '< 1,000',
      min: 0,
      max: 1000
    },

    {
      label: '1,000-5,000',
      min: 1000,
      max: 5000
    },

    {
      label: '5,000-10,000',
      min: 5000,
      max: 10000
    },

    {
      label: '10,000-50,000',
      min: 10000,
      max: 50000
    },

    {
      label: '50,000-1,00,000',
      min: 50000,
      max: 100000
    },

    {
      label: '>1,00,000',
      min: 100000,
      max: Infinity
    }
  ];

  draw(
    '#rangeChart',
    'bar',
    ranges.map(
      range =>
        range.label
    ),
    [
      {
        label: 'Customers',

        data:
          ranges.map(
            range =>
              data.filter(
                row => {
                  const balance =
                    num(
                      row.balance
                    );

                  return (
                    balance >=
                      range.min
                    &&
                    balance <
                      range.max
                  );
                }
              ).length
          ),

        borderRadius: 6
      }
    ],
    {
      countChart: true
    }
  );

  /* =========================
     TOP 5 OUTSTANDING
  ========================= */

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

              num:
                true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  /* =========================
     TOP 5 >150 DAYS
  ========================= */

  const overdueCustomers =
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
          overdueCustomers,
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
                '>150 Days',

              num:
                true,

              render:
                row =>
                  money(
                    row.days_150
                  )
            },

            {
              label:
                'Balance',

              num:
                true,

              render:
                row =>
                  money(
                    row.balance
                  )
            }
          ]
        );
  }

  /* =========================
     CUSTOMER DETAILS
  ========================= */

  renderDetails(data);

  /* =========================
     COMPARISON
  ========================= */

  renderCompare(
    currentMetrics
  );
}

/* =========================================================
   COMPARISON SELECTOR
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
        !activeUpload ||
        upload.id !==
          activeUpload.id
    );

  select.innerHTML = `
    <option value="">
      Select snapshot
    </option>

    ${available.map(
      upload => `
        <option
          value="${esc(upload.id)}"
        >
          ${esc(
            upload.outstanding_date
          )}
        </option>
      `
    ).join('')}
  `;

  /*
    Keep existing comparison if still valid.
  */
  if (
    oldValue &&
    available.some(
      upload =>
        upload.id === oldValue
    )
  ) {
    select.value =
      oldValue;

    return;
  }

  /*
    Otherwise automatically select
    the previous snapshot.
  */
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
   GET COMPARISON SNAPSHOT WITH CACHE
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

  const comparisonRows =
    await getAllOutstandingRows(
      uploadId,
      'Loading comparison'
    );

  snapshotCache.set(
    uploadId,
    comparisonRows
  );

  return comparisonRows;
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
    const comparisonRows =
      await getComparisonRows(
        compareId
      );

    /*
      A newer comparison request started
      while this one was loading.
    */
    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    /*
      Same selected filters are applied
      to comparison snapshot.
    */
    const comparisonFiltered =
      filtered(
        comparisonRows
      );

    const comparisonMetrics =
      metrics(
        comparisonFiltered
      );

    const labels =
      bucketDefs.map(
        item => item[0]
      );

    draw(
      '#compareChart',
      'bar',
      labels,
      [
        {
          label:
            compareUpload
              .outstanding_date,

          data:
            bucketDefs.map(
              item =>
                comparisonMetrics.bs[
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

    const comparisonTable = [
      {
        metric:
          'Total Outstanding',

        previous:
          comparisonMetrics.total,

        current:
          currentMetrics.total,

        count:
          false
      },

      {
        metric:
          'Total Customers',

        previous:
          comparisonMetrics.customers,

        current:
          currentMetrics.customers,

        count:
          true
      },

      {
        metric:
          'PDC Amount',

        previous:
          comparisonMetrics.pdc,

        current:
          currentMetrics.pdc,

        count:
          false
      },

      {
        metric:
          'Over 90 Days',

        previous:
          comparisonMetrics.over90,

        current:
          currentMetrics.over90,

        count:
          false
      },

      {
        metric:
          'Over 150 Days',

        previous:
          comparisonMetrics.over150,

        current:
          currentMetrics.over150,

        count:
          false
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

                num:
                  true,

                render:
                  row =>
                    row.count
                      ? Number(
                          row.previous
                        )
                          .toLocaleString(
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

                num:
                  true,

                render:
                  row =>
                    row.count
                      ? Number(
                          row.current
                        )
                          .toLocaleString(
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

    if (
      requestId !==
      comparisonRequestId
    ) {
      return;
    }

    if ($('#summaryCompare')) {
      $('#summaryCompare')
        .innerHTML = `
          <span class="muted">
            Comparison unavailable:
            ${esc(
              error.message
            )}
          </span>
        `;
    }
  }
}
