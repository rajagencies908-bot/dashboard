/* ============================================================
   RAJ AGENCIES
   LINKED / CASCADING CUSTOMER FILTER
   VERSION: online26

   PURPOSE
   ------------------------------------------------------------
   Customer / Party dropdown automatically follows:

   - Main Group
   - Item Group
   - Item Code
   - Item Name
   - SM
   - Division
   - City
   - Pincode
   - Month
   - Product Sale Status
   - Global Search
   - Budget Target
   - Budget Status
   - OD Team / Order

   PERFORMANCE
   ------------------------------------------------------------
   Only CUSTOMER options are refreshed.

   All other dropdown lists are NOT reloaded.

   This keeps dashboard fast while making customer filter linked.
   ============================================================ */

(() => {

  'use strict';


  /* =========================================================
     STATE
     ========================================================= */

  let rajLinkedInstalled = false;

  let rajLinkedRunning = false;

  let rajLinkedLastSignature = '';

  let rajLinkedRequestId = 0;


  /* =========================================================
     HELPERS
     ========================================================= */

  const rajLinkedEl = id =>
    document.getElementById(id);


  function rajLinkedEsc(value){

    const div =
      document.createElement(
        'div'
      );


    div.textContent =
      String(
        value ?? ''
      );


    return div.innerHTML;

  }


  function rajLinkedUnique(values){

    return [
      ...new Set(
        (
          Array.isArray(values)
            ? values
            : []
        )
          .map(
            value =>
              String(
                value ?? ''
              ).trim()
          )
          .filter(Boolean)
      )
    ];

  }


  /* =========================================================
     CURRENT FILTER SIGNATURE

     Party itself is intentionally NOT included.

     We refresh Customer options only when another
     relevant filter changes.
     ========================================================= */

  function rajLinkedSignature(){

    try{

      const target =
        rajLinkedEl(
          'budgetTarget'
        )
          ?.value
        ||
        'all';


      const status =
        rajLinkedEl(
          'budgetStatus'
        )
          ?.value
        ||
        'all';


      const saleStatus =
        rajLinkedEl(
          'productSaleStatus'
        )
          ?.value
        ||
        'All';


      const search =
        rajLinkedEl(
          'search'
        )
          ?.value
          ?.trim()
        ||
        '';


      const state = {

        MainGrp:
          [
            ...(selected.MainGrp || [])
          ].sort(),

        ItemGroup:
          [
            ...(selected.ItemGroup || [])
          ].sort(),

        ItemCode:
          [
            ...(selected.ItemCode || [])
          ].sort(),

        ItemName:
          [
            ...(selected.ItemName || [])
          ].sort(),

        SM:
          [
            ...(selected.SM || [])
          ].sort(),

        Division:
          [
            ...(selected.Division || [])
          ].sort(),

        City:
          [
            ...(selected.City || [])
          ].sort(),

        Pincode:
          [
            ...(selected.Pincode || [])
          ].sort(),

        month:
          [
            ...(selected.month || [])
          ].sort(),

        budgetOD:
          [
            ...(selected.budgetOD || [])
          ].sort(),

        target:
          target,

        status:
          status,

        saleStatus:
          saleStatus,

        search:
          search

      };


      return JSON.stringify(
        state
      );


    }catch(error){

      console.warn(
        'Linked customer signature error:',
        error
      );


      return String(
        Date.now()
      );

    }

  }


  /* =========================================================
     PARSE FILTER RPC RESULT
     ========================================================= */

  function rajLinkedParseValues(data){

    const rawValues =

      (data || [])
        .map(
          value => {

            if(
              typeof value === 'object'
              &&
              value !== null
            ){

              return (

                value.value

                ??

                value.Value

                ??

                Object.values(
                  value
                )[0]

              );

            }


            return value;

          }
        );


    return rajLinkedUnique(
      rawValues
    );

  }


  /* =========================================================
     UPDATE CUSTOMER LABEL
     ========================================================= */

  function rajLinkedUpdatePartyLabel(){

    try{

      if(
        typeof updateMultiLabel
        === 'function'
      ){

        updateMultiLabel(
          'Party'
        );


        return;

      }

    }catch(_){}


    const label =
      rajLinkedEl(
        'label_Party'
      );


    const chips =
      rajLinkedEl(
        'chips_Party'
      );


    if(label){

      label.textContent =

        selected.Party.length

          ? `${selected.Party.length} selected`

          : 'All Customers';

    }


    if(chips){

      chips.innerHTML =

        selected.Party
          .slice(
            0,
            4
          )
          .map(
            value =>
              `<span class="chip">${
                rajLinkedEsc(value)
              }</span>`
          )
          .join('')


        +


        (
          selected.Party.length > 4

            ? `<span class="chip">+${
                selected.Party.length - 4
              }</span>`

            : ''
        );

    }

  }


  /* =========================================================
     RESTORE PARTY DROPDOWN OPEN STATE
     ========================================================= */

  function rajLinkedRestorePartyOpen(){

    try{

      if(
        typeof restoreOpenFilter
        === 'function'
      ){

        restoreOpenFilter(
          'Party'
        );


        return;

      }

    }catch(_){}


    const multi =
      rajLinkedEl(
        'multi_Party'
      );


    if(multi){

      multi.classList.add(
        'open'
      );

    }

  }


  /* =========================================================
     CUSTOMER CHECKBOX HANDLER
     ========================================================= */

  function rajLinkedWirePartyCheckboxes(){

    const box =
      rajLinkedEl(
        'options_Party'
      );


    if(!box){

      return;

    }


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
                  !selected.Party.includes(
                    checkbox.value
                  )
                ){

                  selected.Party.push(
                    checkbox.value
                  );

                }


              }else{

                selected.Party =

                  selected.Party.filter(
                    value =>
                      value !==
                      checkbox.value
                  );

              }


              rajLinkedUpdatePartyLabel();


              try{

                page =
                  1;

                budgetPage =
                  1;

              }catch(_){}


              /*
                Party changed manually.

                Dashboard reloads data,
                but linked customer list itself does not
                need another server refresh because Party
                isn't part of linked signature.
              */

              if(
                typeof loadDashboard
                === 'function'
              ){

                await loadDashboard(
                  false
                );

              }


              rajLinkedRestorePartyOpen();

            };

        }
      );

  }


  /* =========================================================
     RENDER LINKED CUSTOMERS
     ========================================================= */

  function rajLinkedRenderPartyOptions(
    values
  ){

    const box =
      rajLinkedEl(
        'options_Party'
      );


    if(!box){

      return;

    }


    /*
      Preserve search text.
    */

    let searchText =
      '';


    try{

      searchText =
        searchState.Party
        ||
        rajLinkedEl(
          'search_Party'
        )
          ?.value
        ||
        '';

    }catch(_){}


    /*
      Standard dashboard Select All / Unselect All buttons.
    */

    let buttons = '';


    try{

      if(
        typeof bulkButtons
        === 'function'
      ){

        buttons =
          bulkButtons(
            'Party'
          );

      }

    }catch(_){}


    box.innerHTML =

      buttons

      +

      values
        .map(
          value => `

            <label
              class="multi-option"
              data-text="${rajLinkedEsc(
                String(value)
                  .toLowerCase()
              )}"
            >

              <input
                type="checkbox"
                value="${rajLinkedEsc(value)}"
                ${
                  selected.Party.includes(
                    String(value)
                  )
                    ? 'checked'
                    : ''
                }
              >

              <span>
                ${rajLinkedEsc(value)}
              </span>

            </label>

          `
        )
        .join('');


    rajLinkedWirePartyCheckboxes();


    /*
      Restore Customer search filter.
    */

    try{

      searchState.Party =
        searchText;


      if(
        typeof applySearchFilter
        === 'function'
      ){

        applySearchFilter(
          'Party'
        );

      }

    }catch(_){}

  }


  /* =========================================================
     FETCH LINKED CUSTOMER VALUES
     ========================================================= */

  async function rajRefreshLinkedCustomers(
    force = false
  ){

    if(
      rajLinkedRunning
    ){

      return;

    }


    if(
      typeof rpc
      !== 'function'
      ||
      typeof filterArgs
      !== 'function'
    ){

      return;

    }


    const signature =
      rajLinkedSignature();


    if(
      !force
      &&
      signature ===
      rajLinkedLastSignature
    ){

      return;

    }


    const requestId =
      ++rajLinkedRequestId;


    rajLinkedRunning =
      true;


    try{

      /*
        filterArgs('Party') already uses:
        - selected SM
        - Main Group
        - City
        - Division
        - Pincode
        - Item filters
        - Month
        - Search
        - Target / OD / Budget Status Party scope
      */

      const data =
        await rpc(
          'raj_filter_values',
          {

            p_column:
              'Party',

            ...filterArgs(
              'Party'
            )

          }
        );


      /*
        Ignore stale result if a newer refresh started.
      */

      if(
        requestId !==
        rajLinkedRequestId
      ){

        return;

      }


      const values =
        rajLinkedParseValues(
          data
        );


      const validSet =
        new Set(
          values.map(
            String
          )
        );


      /*
        IMPORTANT:

        If SM / City / OD / Target changes,
        an old selected customer might no longer belong
        to the new filter scope.

        Remove invalid selected customers automatically.
      */

      const oldParty =
        [
          ...(selected.Party || [])
        ];


      selected.Party =

        oldParty.filter(
          party =>
            validSet.has(
              String(party)
            )
        );


      const partyWasRemoved =

        selected.Party.length
        !==
        oldParty.length;


      rajLinkedUpdatePartyLabel();


      rajLinkedRenderPartyOptions(
        values
      );


      rajLinkedLastSignature =
        signature;


      /*
        If an invalid old customer was removed,
        reload data once with corrected Party selection.

        This prevents:
        SM = Dh
        old customer from another SM still filtering data.
      */

      if(
        partyWasRemoved
        &&
        typeof loadDashboard
          === 'function'
      ){

        try{

          page =
            1;

          budgetPage =
            1;

        }catch(_){}


        await loadDashboard(
          false
        );

      }


    }catch(error){

      console.error(
        'Linked Customer Filter Error:',
        error
      );


    }finally{

      rajLinkedRunning =
        false;

    }

  }


  /* =========================================================
     WRAP DASHBOARD LOADER

     Current speed addon intentionally avoids reloading every
     filter list.

     We keep that behavior and refresh ONLY Customer / Party.
     ========================================================= */

  function rajInstallLinkedDashboard(){

    if(
      rajLinkedInstalled
    ){

      return true;

    }


    if(
      typeof loadDashboard
      !== 'function'
    ){

      return false;

    }


    const previousLoadDashboard =
      loadDashboard;


    loadDashboard =
      async function(
        ...args
      ){

        const result =
          await previousLoadDashboard
            .apply(
              this,
              args
            );


        /*
          refreshBudgetSalesScope() has already run inside
          the dashboard load at this point.

          Therefore OD / Target customer scope is ready.
        */

        await rajRefreshLinkedCustomers(
          false
        );


        return result;

      };


    rajLinkedInstalled =
      true;


    return true;

  }


  /* =========================================================
     REFRESH CUSTOMER WHEN PARTY DROPDOWN OPENS

     This is an additional safety check.
     ========================================================= */

  function rajWirePartyOpen(){

    const button =
      document.querySelector(
        '[data-open="Party"]'
      );


    if(
      !button
      ||
      button.dataset.rajLinkedPartyOpen
        === '1'
    ){

      return;

    }


    button.dataset.rajLinkedPartyOpen =
      '1';


    button.addEventListener(
      'click',
      () => {

        setTimeout(
          () => {

            rajRefreshLinkedCustomers(
              false
            );

          },
          0
        );

      }
    );

  }


  /* =========================================================
     TARGET / STATUS DIRECT CHANGE SAFETY
     ========================================================= */

  function rajWireBudgetSelectors(){

    [
      'budgetTarget',
      'budgetStatus',
      'productSaleStatus'
    ]
      .forEach(
        id => {

          const node =
            rajLinkedEl(id);


          if(
            !node
            ||
            node.dataset.rajLinkedChange
              === '1'
          ){

            return;

          }


          node.dataset.rajLinkedChange =
            '1';


          node.addEventListener(
            'change',
            () => {

              /*
                Dashboard's own handler runs too.

                Linked refresh happens after dashboard completes.
              */

              setTimeout(
                () => {

                  rajRefreshLinkedCustomers(
                    false
                  );

                },
                250
              );

            }
          );

        }
      );

  }


  /* =========================================================
     GLOBAL SEARCH SAFETY
     ========================================================= */

  function rajWireGlobalSearch(){

    const search =
      rajLinkedEl(
        'search'
      );


    if(
      !search
      ||
      search.dataset.rajLinkedSearch
        === '1'
    ){

      return;

    }


    search.dataset.rajLinkedSearch =
      '1';


    search.addEventListener(
      'input',
      () => {

        /*
          Don't query on every keystroke instantly.
        */

        clearTimeout(
          window.__rajLinkedSearchTimer
        );


        window.__rajLinkedSearchTimer =
          setTimeout(
            () => {

              rajRefreshLinkedCustomers(
                false
              );

            },
            500
          );

      }
    );

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  function rajInitLinkedCustomer(){

    let attempts =
      0;


    const timer =
      setInterval(
        () => {

          attempts++;


          rajWirePartyOpen();

          rajWireBudgetSelectors();

          rajWireGlobalSearch();


          const installed =
            rajInstallLinkedDashboard();


          if(
            installed
            &&
            typeof selected
              !== 'undefined'
            &&
            rajLinkedEl(
              'options_Party'
            )
          ){

            /*
              First customer list sync.
            */

            setTimeout(
              () => {

                rajRefreshLinkedCustomers(
                  true
                );

              },
              800
            );


            clearInterval(
              timer
            );

          }


          if(
            attempts >= 200
          ){

            clearInterval(
              timer
            );

          }

        },
        100
      );


    /*
      Main script may rebuild filter UI during startup.
      Light safety wiring only; no database query here.
    */

    setInterval(
      () => {

        rajWirePartyOpen();

        rajWireBudgetSelectors();

        rajWireGlobalSearch();

      },
      1500
    );

  }


  if(
    document.readyState
    === 'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      rajInitLinkedCustomer,
      {
        once:true
      }
    );


  }else{

    rajInitLinkedCustomer();

  }


})();
