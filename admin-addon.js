/* ============================================================
   RAJ AGENCIES
   ADMIN USER MANAGEMENT ADDON
   Version: online20

   Features:
   - Admin-only User Management Panel
   - Add New User
   - Edit User
   - Mobile Number
   - Role
   - SM Access
   - OD Access
   - Active / Inactive
   - Device Lock ON / OFF
   - Change Password
   - Reset Device
   - Login Logs
   ============================================================ */

(() => {

  'use strict';


  /* =========================================================
     STORAGE KEYS
     ========================================================= */

  const DEVICE_KEY =
    'raj_dashboard_device_id';

  const SESSION_KEY =
    'raj_dashboard_session_token';

  const USER_KEY =
    'raj_dashboard_user';


  /* =========================================================
     STATE
     ========================================================= */

  let adminUsers = [];

  let smOptions = [];

  let odOptions = [];

  let editingUser = null;

  let initialized = false;


  /* =========================================================
     HELPERS
     ========================================================= */

  const $ = id =>
    document.getElementById(id);


  function escapeHtml(value){

    const div =
      document.createElement('div');

    div.textContent =
      String(value ?? '');

    return div.innerHTML;

  }


  function getStoredUser(){

    try{

      return JSON.parse(
        localStorage.getItem(USER_KEY)
        || 'null'
      );

    }catch{

      return null;

    }

  }


  function getSessionToken(){

    return (
      localStorage.getItem(SESSION_KEY)
      || ''
    );

  }


  function getDeviceId(){

    return (
      localStorage.getItem(DEVICE_KEY)
      || ''
    );

  }


  function isAdminUser(user){

    if(!user){
      return false;
    }

    return (
      String(user.role || '') === 'Admin'
      ||
      user.full_view === true
    );

  }


  function formatDate(value){

    if(!value){
      return '-';
    }

    try{

      return new Date(value)
        .toLocaleString(
          'en-IN',
          {
            dateStyle:'medium',
            timeStyle:'short'
          }
        );

    }catch{

      return String(value);

    }

  }


  function showMessage(
    message,
    type = 'success'
  ){

    const box =
      $('rajAdminMessage');

    if(!box){
      return;
    }

    box.textContent =
      message || '';

    box.className =
      'raj-admin-message ' +
      (
        type === 'error'
          ? 'error'
          : 'success'
      );


    if(message){

      setTimeout(
        () => {

          if(
            box.textContent === message
          ){
            box.textContent = '';
            box.className =
              'raj-admin-message';
          }

        },
        5000
      );

    }

  }


  async function rpc(
    functionName,
    params
  ){

    if(
      typeof sb === 'undefined'
      ||
      !sb
    ){

      throw new Error(
        'Supabase client is not ready.'
      );

    }


    const {
      data,
      error
    } =
      await sb.rpc(
        functionName,
        params
      );


    if(error){
      throw error;
    }


    if(
      data
      &&
      data.success === false
    ){

      throw new Error(
        data.message
        || 'Operation failed.'
      );

    }


    return data;

  }


  function adminAuthParams(){

    return {
      p_admin_session_token:
        getSessionToken(),

      p_admin_device_id:
        getDeviceId()
    };

  }


  /* =========================================================
     CSS
     ========================================================= */

  function addStyles(){

    if(
      $('rajAdminStyles')
    ){
      return;
    }


    const style =
      document.createElement('style');


    style.id =
      'rajAdminStyles';


    style.textContent = `

      #rajAdminButton{
        border:0;
        cursor:pointer;

        padding:
          9px 14px;

        border-radius:999px;

        color:#fff;

        font-size:10px;
        font-weight:900;

        background:
          linear-gradient(
            135deg,
            #4338ca,
            #7c3aed
          );

        box-shadow:
          0 8px 20px
          rgba(79,70,229,.22);
      }


      #rajAdminOverlay{
        position:fixed;
        inset:0;

        z-index:999998;

        display:none;

        overflow:auto;

        padding:24px;

        background:
          rgba(15,23,42,.60);

        backdrop-filter:
          blur(8px);

        -webkit-backdrop-filter:
          blur(8px);
      }


      #rajAdminOverlay.open{
        display:block;
      }


      .raj-admin-shell{
        width:min(1400px,100%);

        margin:0 auto;

        min-height:
          calc(100vh - 48px);

        border-radius:25px;

        background:#f8fafc;

        box-shadow:
          0 30px 90px
          rgba(0,0,0,.25);

        overflow:hidden;
      }


      .raj-admin-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;

        padding:21px 24px;

        background:
          linear-gradient(
            135deg,
            #312e81,
            #5b21b6,
            #7e22ce
          );

        color:#fff;
      }


      .raj-admin-head h2{
        margin:0 0 4px;

        font-size:22px;
        font-weight:900;
      }


      .raj-admin-head p{
        margin:0;

        opacity:.82;

        font-size:11px;
      }


      #rajAdminClose{
        width:40px;
        height:40px;

        border:0;
        border-radius:50%;

        cursor:pointer;

        color:#fff;

        background:
          rgba(255,255,255,.16);

        font-size:21px;
      }


      .raj-admin-toolbar{
        display:flex;
        flex-wrap:wrap;
        gap:10px;

        padding:17px 20px;

        border-bottom:
          1px solid #e2e8f0;

        background:#fff;
      }


      .raj-admin-toolbar button{
        border:1px solid #ddd6fe;

        cursor:pointer;

        padding:10px 15px;

        border-radius:11px;

        background:#f5f3ff;

        color:#5b21b6;

        font-size:11px;
        font-weight:850;
      }


      .raj-admin-toolbar button.active{
        border-color:#6d28d9;

        background:#6d28d9;

        color:#fff;
      }


      .raj-admin-message{
        min-height:20px;

        margin:
          12px
          20px
          0;

        font-size:12px;
        font-weight:800;
      }


      .raj-admin-message.success{
        color:#15803d;
      }


      .raj-admin-message.error{
        color:#b91c1c;
      }


      .raj-admin-content{
        padding:20px;
      }


      .raj-admin-section{
        display:none;
      }


      .raj-admin-section.active{
        display:block;
      }


      .raj-admin-section-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;

        margin-bottom:15px;
      }


      .raj-admin-section-head h3{
        margin:0;

        color:#17213c;

        font-size:18px;
      }


      .raj-admin-primary{
        border:0;

        cursor:pointer;

        padding:10px 15px;

        border-radius:11px;

        color:#fff;

        background:
          linear-gradient(
            135deg,
            #4f46e5,
            #7c3aed
          );

        font-size:11px;
        font-weight:900;
      }


      .raj-admin-secondary{
        border:
          1px solid #cbd5e1;

        cursor:pointer;

        padding:9px 12px;

        border-radius:10px;

        color:#334155;

        background:#fff;

        font-size:10px;
        font-weight:800;
      }


      .raj-admin-danger{
        border:
          1px solid #fecdd3;

        cursor:pointer;

        padding:9px 12px;

        border-radius:10px;

        color:#be123c;

        background:#fff1f2;

        font-size:10px;
        font-weight:850;
      }


      .raj-admin-warning{
        border:
          1px solid #fde68a;

        cursor:pointer;

        padding:9px 12px;

        border-radius:10px;

        color:#92400e;

        background:#fffbeb;

        font-size:10px;
        font-weight:850;
      }


      .raj-admin-table-wrap{
        width:100%;
        overflow:auto;

        border:
          1px solid #e2e8f0;

        border-radius:15px;

        background:#fff;
      }


      .raj-admin-table{
        width:100%;

        border-collapse:collapse;

        min-width:1100px;
      }


      .raj-admin-table th{
        position:sticky;
        top:0;

        z-index:1;

        padding:12px 10px;

        border-bottom:
          1px solid #e2e8f0;

        background:#f8fafc;

        color:#475569;

        text-align:left;

        white-space:nowrap;

        font-size:10px;
        font-weight:900;
      }


      .raj-admin-table td{
        padding:11px 10px;

        border-bottom:
          1px solid #f1f5f9;

        color:#334155;

        vertical-align:top;

        font-size:11px;
      }


      .raj-admin-table tr:last-child td{
        border-bottom:0;
      }


      .raj-admin-user-name{
        color:#17213c;

        font-weight:900;
      }


      .raj-admin-code{
        display:inline-block;

        margin:
          2px
          3px
          2px
          0;

        padding:
          3px
          7px;

        border-radius:999px;

        background:#ede9fe;

        color:#6d28d9;

        font-size:9px;
        font-weight:850;
      }


      .raj-status{
        display:inline-block;

        padding:
          4px
          8px;

        border-radius:999px;

        font-size:9px;
        font-weight:900;
      }


      .raj-status.active{
        color:#166534;
        background:#dcfce7;
      }


      .raj-status.inactive{
        color:#991b1b;
        background:#fee2e2;
      }


      .raj-status.locked{
        color:#92400e;
        background:#fef3c7;
      }


      .raj-status.free{
        color:#166534;
        background:#dcfce7;
      }


      .raj-admin-actions{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
      }


      .raj-admin-form-wrap{
        display:none;

        margin-bottom:20px;

        padding:18px;

        border:
          1px solid #ddd6fe;

        border-radius:17px;

        background:#fff;
      }


      .raj-admin-form-wrap.open{
        display:block;
      }


      .raj-admin-form-title{
        margin:
          0
          0
          16px;

        color:#312e81;

        font-size:16px;
        font-weight:900;
      }


      .raj-admin-form-grid{
        display:grid;

        grid-template-columns:
          repeat(
            auto-fit,
            minmax(210px,1fr)
          );

        gap:14px;
      }


      .raj-admin-field label{
        display:block;

        margin-bottom:6px;

        color:#475569;

        font-size:10px;
        font-weight:900;
      }


      .raj-admin-field input,
      .raj-admin-field select{
        width:100%;

        min-height:42px;

        padding:
          0
          11px;

        border:
          1px solid #cbd5e1;

        border-radius:10px;

        outline:none;

        background:#fff;

        color:#17213c;

        font-size:12px;
      }


      .raj-admin-field input:focus,
      .raj-admin-field select:focus{
        border-color:#7c3aed;

        box-shadow:
          0 0 0 3px
          rgba(124,58,237,.10);
      }


      .raj-admin-check-row{
        display:flex;
        flex-wrap:wrap;
        gap:15px;

        margin-top:16px;
      }


      .raj-admin-check{
        display:flex;
        align-items:center;
        gap:7px;

        color:#334155;

        font-size:11px;
        font-weight:800;
      }


      .raj-admin-check input{
        width:17px;
        height:17px;
      }


      .raj-access-box{
        margin-top:16px;

        padding:14px;

        border:
          1px solid #e2e8f0;

        border-radius:13px;

        background:#f8fafc;
      }


      .raj-access-box h4{
        margin:
          0
          0
          10px;

        color:#334155;

        font-size:11px;
        font-weight:900;
      }


      .raj-access-list{
        display:grid;

        grid-template-columns:
          repeat(
            auto-fill,
            minmax(80px,1fr)
          );

        gap:7px;

        max-height:180px;

        overflow:auto;
      }


      .raj-access-option{
        display:flex;
        align-items:center;
        gap:6px;

        padding:
          7px
          8px;

        border:
          1px solid #e2e8f0;

        border-radius:9px;

        background:#fff;

        color:#334155;

        font-size:10px;
        font-weight:800;
      }


      .raj-access-option input{
        width:15px;
        height:15px;
      }


      .raj-admin-form-actions{
        display:flex;
        flex-wrap:wrap;
        gap:9px;

        margin-top:17px;
      }


      .raj-admin-empty{
        padding:30px;

        text-align:center;

        color:#94a3b8;

        font-size:12px;
      }


      .raj-log-success{
        color:#15803d;
        font-weight:900;
      }


      .raj-log-blocked{
        color:#b45309;
        font-weight:900;
      }


      .raj-log-failed{
        color:#b91c1c;
        font-weight:900;
      }


      .raj-admin-loading{
        padding:25px;

        text-align:center;

        color:#64748b;

        font-size:12px;
        font-weight:800;
      }


      #rajPasswordOverlay{
        position:fixed;
        inset:0;

        z-index:1000000;

        display:none;

        align-items:center;
        justify-content:center;

        padding:20px;

        background:
          rgba(15,23,42,.70);
      }


      #rajPasswordOverlay.open{
        display:flex;
      }


      .raj-password-box{
        width:min(420px,100%);

        padding:22px;

        border-radius:18px;

        background:#fff;

        box-shadow:
          0 25px 70px
          rgba(0,0,0,.25);
      }


      .raj-password-box h3{
        margin:
          0
          0
          6px;

        color:#17213c;
      }


      .raj-password-box p{
        margin:
          0
          0
          16px;

        color:#64748b;

        font-size:11px;
      }


      @media(max-width:700px){

        #rajAdminOverlay{
          padding:8px;
        }

        .raj-admin-shell{
          min-height:
            calc(100vh - 16px);

          border-radius:16px;
        }

        .raj-admin-head{
          padding:17px;
        }

        .raj-admin-content{
          padding:12px;
        }

      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* =========================================================
     CREATE ADMIN BUTTON
     ========================================================= */

  function createAdminButton(){

    const user =
      getStoredUser();


    if(
      !isAdminUser(user)
    ){
      return false;
    }


    const userArea =
      $('rajUserArea');


    if(!userArea){
      return false;
    }


    if(
      $('rajAdminButton')
    ){
      return true;
    }


    const button =
      document.createElement('button');


    button.id =
      'rajAdminButton';

    button.type =
      'button';

    button.textContent =
      'Admin Panel';


    button.addEventListener(
      'click',
      openAdminPanel
    );


    userArea.insertBefore(
      button,
      userArea.firstChild
    );


    return true;

  }


  /* =========================================================
     ADMIN PANEL HTML
     ========================================================= */

  function createAdminPanel(){

    if(
      $('rajAdminOverlay')
    ){
      return;
    }


    const overlay =
      document.createElement('div');


    overlay.id =
      'rajAdminOverlay';


    overlay.innerHTML = `

      <div class="raj-admin-shell">

        <div class="raj-admin-head">

          <div>

            <h2>
              Admin User Management
            </h2>

            <p>
              Users, roles, access, passwords, devices and login logs
            </p>

          </div>

          <button
            type="button"
            id="rajAdminClose"
            title="Close"
          >
            ×
          </button>

        </div>


        <div class="raj-admin-toolbar">

          <button
            type="button"
            class="raj-admin-tab active"
            data-admin-tab="users"
          >
            Users
          </button>

          <button
            type="button"
            class="raj-admin-tab"
            data-admin-tab="logs"
          >
            Login Logs
          </button>

          <button
            type="button"
            id="rajAdminRefresh"
          >
            Refresh
          </button>

        </div>


        <div
          id="rajAdminMessage"
          class="raj-admin-message"
        ></div>


        <div class="raj-admin-content">


          <!-- =============================================
               USERS SECTION
               ============================================= -->

          <section
            id="rajAdminUsersSection"
            class="raj-admin-section active"
          >

            <div class="raj-admin-section-head">

              <h3>
                User Management
              </h3>

              <button
                type="button"
                id="rajAddUserBtn"
                class="raj-admin-primary"
              >
                + Add New User
              </button>

            </div>


            <div
              id="rajUserFormWrap"
              class="raj-admin-form-wrap"
            >

              <h4
                id="rajUserFormTitle"
                class="raj-admin-form-title"
              >
                Add New User
              </h4>


              <div class="raj-admin-form-grid">


                <div class="raj-admin-field">

                  <label>
                    Name
                  </label>

                  <input
                    type="text"
                    id="rajAdminName"
                    placeholder="User name"
                  >

                </div>


                <div class="raj-admin-field">

                  <label>
                    Mobile Number
                  </label>

                  <input
                    type="tel"
                    id="rajAdminMobile"
                    maxlength="10"
                    inputmode="numeric"
                    placeholder="10 digit mobile"
                  >

                </div>


                <div class="raj-admin-field">

                  <label>
                    Role
                  </label>

                  <select id="rajAdminRole">

                    <option value="SM">
                      SM
                    </option>

                    <option value="OD">
                      OD
                    </option>

                    <option value="SalesHead">
                      Sales Head
                    </option>

                    <option value="Admin">
                      Admin
                    </option>

                  </select>

                </div>


                <div class="raj-admin-field">

                  <label>
                    Password
                  </label>

                  <input
                    type="password"
                    id="rajAdminPassword"
                    placeholder="New user: minimum 6 characters"
                  >

                </div>

              </div>


              <div class="raj-admin-check-row">

                <label class="raj-admin-check">

                  <input
                    type="checkbox"
                    id="rajAdminActive"
                    checked
                  >

                  Active User

                </label>


                <label class="raj-admin-check">

                  <input
                    type="checkbox"
                    id="rajAdminDeviceLock"
                    checked
                  >

                  Device Lock Enabled

                </label>


                <label class="raj-admin-check">

                  <input
                    type="checkbox"
                    id="rajAdminFullView"
                  >

                  Full View

                </label>

              </div>


              <div
                id="rajSmAccessBox"
                class="raj-access-box"
              >

                <h4>
                  SM Access
                </h4>

                <div
                  id="rajSmAccessList"
                  class="raj-access-list"
                ></div>

              </div>


              <div
                id="rajOdAccessBox"
                class="raj-access-box"
              >

                <h4>
                  OD Access
                </h4>

                <div
                  id="rajOdAccessList"
                  class="raj-access-list"
                ></div>

              </div>


              <div class="raj-admin-form-actions">

                <button
                  type="button"
                  id="rajSaveUserBtn"
                  class="raj-admin-primary"
                >
                  Save User
                </button>

                <button
                  type="button"
                  id="rajCancelUserBtn"
                  class="raj-admin-secondary"
                >
                  Cancel
                </button>

              </div>

            </div>


            <div
              id="rajUsersLoading"
              class="raj-admin-loading"
            >
              Loading users...
            </div>


            <div
              id="rajUsersTableWrap"
              class="raj-admin-table-wrap"
              style="display:none"
            >

              <table class="raj-admin-table">

                <thead>

                  <tr>

                    <th>
                      Name
                    </th>

                    <th>
                      Mobile
                    </th>

                    <th>
                      Role
                    </th>

                    <th>
                      SM Access
                    </th>

                    <th>
                      OD Access
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Device
                    </th>

                    <th>
                      Last Login
                    </th>

                    <th>
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody id="rajUsersBody"></tbody>

              </table>

            </div>

          </section>


          <!-- =============================================
               LOGS SECTION
               ============================================= -->

          <section
            id="rajAdminLogsSection"
            class="raj-admin-section"
          >

            <div class="raj-admin-section-head">

              <h3>
                Login Logs
              </h3>

              <button
                type="button"
                id="rajRefreshLogsBtn"
                class="raj-admin-secondary"
              >
                Refresh Logs
              </button>

            </div>


            <div
              id="rajLogsLoading"
              class="raj-admin-loading"
            >
              Loading login logs...
            </div>


            <div
              id="rajLogsTableWrap"
              class="raj-admin-table-wrap"
              style="display:none"
            >

              <table class="raj-admin-table">

                <thead>

                  <tr>

                    <th>
                      Date / Time
                    </th>

                    <th>
                      User
                    </th>

                    <th>
                      Mobile
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Device
                    </th>

                    <th>
                      Details
                    </th>

                  </tr>

                </thead>

                <tbody id="rajLogsBody"></tbody>

              </table>

            </div>

          </section>


        </div>

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    /* -------------------------------------------------------
       Password Popup
       ------------------------------------------------------- */

    const passwordOverlay =
      document.createElement('div');


    passwordOverlay.id =
      'rajPasswordOverlay';


    passwordOverlay.innerHTML = `

      <div class="raj-password-box">

        <h3>
          Change Password
        </h3>

        <p id="rajPasswordUserText">
          User
        </p>


        <div class="raj-admin-field">

          <label>
            New Password
          </label>

          <input
            type="password"
            id="rajNewPassword"
            placeholder="Minimum 6 characters"
          >

        </div>


        <div class="raj-admin-form-actions">

          <button
            type="button"
            id="rajPasswordSave"
            class="raj-admin-primary"
          >
            Change Password
          </button>

          <button
            type="button"
            id="rajPasswordCancel"
            class="raj-admin-secondary"
          >
            Cancel
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      passwordOverlay
    );


    bindAdminEvents();

  }


  /* =========================================================
     EVENTS
     ========================================================= */

  function bindAdminEvents(){

    $('rajAdminClose')
      ?.addEventListener(
        'click',
        closeAdminPanel
      );


    $('rajAdminOverlay')
      ?.addEventListener(
        'click',
        event => {

          if(
            event.target.id ===
            'rajAdminOverlay'
          ){
            closeAdminPanel();
          }

        }
      );


    document
      .querySelectorAll(
        '.raj-admin-tab'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              switchAdminTab(
                button.dataset.adminTab
              );

            }
          );

        }
      );


    $('rajAdminRefresh')
      ?.addEventListener(
        'click',
        async () => {

          await loadAdminData();

          showMessage(
            'Admin data refreshed.'
          );

        }
      );


    $('rajAddUserBtn')
      ?.addEventListener(
        'click',
        startAddUser
      );


    $('rajCancelUserBtn')
      ?.addEventListener(
        'click',
        closeUserForm
      );


    $('rajSaveUserBtn')
      ?.addEventListener(
        'click',
        saveUser
      );


    $('rajAdminRole')
      ?.addEventListener(
        'change',
        updateRoleAccessVisibility
      );


    $('rajAdminMobile')
      ?.addEventListener(
        'input',
        event => {

          event.target.value =
            event.target.value
              .replace(/\D/g,'')
              .slice(0,10);

        }
      );


    $('rajRefreshLogsBtn')
      ?.addEventListener(
        'click',
        loadLoginLogs
      );


    $('rajPasswordCancel')
      ?.addEventListener(
        'click',
        closePasswordPopup
      );


    $('rajPasswordSave')
      ?.addEventListener(
        'click',
        submitPasswordChange
      );

  }


  /* =========================================================
     OPEN / CLOSE
     ========================================================= */

  async function openAdminPanel(){

    const user =
      getStoredUser();


    if(
      !isAdminUser(user)
    ){

      alert(
        'Admin access required.'
      );

      return;

    }


    createAdminPanel();


    $('rajAdminOverlay')
      ?.classList
      .add('open');


    document.body.style.overflow =
      'hidden';


    switchAdminTab(
      'users'
    );


    await loadAdminData();

  }


  function closeAdminPanel(){

    $('rajAdminOverlay')
      ?.classList
      .remove('open');


    document.body.style.overflow =
      '';


    closeUserForm();

  }


  function switchAdminTab(tab){

    document
      .querySelectorAll(
        '.raj-admin-tab'
      )
      .forEach(
        button => {

          button.classList.toggle(
            'active',
            button.dataset.adminTab === tab
          );

        }
      );


    $('rajAdminUsersSection')
      ?.classList
      .toggle(
        'active',
        tab === 'users'
      );


    $('rajAdminLogsSection')
      ?.classList
      .toggle(
        'active',
        tab === 'logs'
      );


    if(tab === 'logs'){

      loadLoginLogs();

    }

  }


  /* =========================================================
     LOAD ADMIN DATA
     ========================================================= */

  async function loadAdminData(){

    await Promise.all([
      loadAccessOptions(),
      loadUsers()
    ]);

  }


  async function loadAccessOptions(){

    try{

      const params =
        adminAuthParams();


      const data =
        await rpc(
          'raj_admin_access_options',
          params
        );


      smOptions =
        Array.isArray(
          data?.sm_options
        )
          ? data.sm_options
          : [];


      odOptions =
        Array.isArray(
          data?.od_options
        )
          ? data.od_options
          : [];


      renderAccessOptions();


    }catch(error){

      console.error(
        'Access options error:',
        error
      );


      showMessage(
        error.message
        || 'Unable to load SM/OD options.',
        'error'
      );

    }

  }


  async function loadUsers(){

    const loading =
      $('rajUsersLoading');

    const tableWrap =
      $('rajUsersTableWrap');


    if(loading){
      loading.style.display =
        'block';
    }


    if(tableWrap){
      tableWrap.style.display =
        'none';
    }


    try{

      const params =
        adminAuthParams();


      const data =
        await rpc(
          'raj_admin_list_users',
          params
        );


      adminUsers =
        Array.isArray(
          data?.users
        )
          ? data.users
          : [];


      renderUsers();


    }catch(error){

      console.error(
        'User list error:',
        error
      );


      showMessage(
        error.message
        || 'Unable to load users.',
        'error'
      );


      if(loading){

        loading.textContent =
          'Unable to load users.';

      }


      return;

    }


    if(loading){
      loading.style.display =
        'none';
    }


    if(tableWrap){
      tableWrap.style.display =
        'block';
    }

  }


  /* =========================================================
     RENDER USERS
     ========================================================= */

  function renderCodes(values){

    if(
      !Array.isArray(values)
      ||
      values.length === 0
    ){
      return '-';
    }


    return values
      .map(
        value =>
          `<span class="raj-admin-code">${
            escapeHtml(value)
          }</span>`
      )
      .join('');

  }


  function renderUsers(){

    const body =
      $('rajUsersBody');


    if(!body){
      return;
    }


    if(
      adminUsers.length === 0
    ){

      body.innerHTML = `

        <tr>

          <td
            colspan="9"
            class="raj-admin-empty"
          >
            No users found.
          </td>

        </tr>

      `;

      return;

    }


    body.innerHTML =
      adminUsers
        .map(
          user => {

            const active =
              user.active === true;


            const locked =
              user.device_locked === true;


            return `

              <tr>

                <td>

                  <div class="raj-admin-user-name">
                    ${escapeHtml(user.name)}
                  </div>

                </td>


                <td>
                  ${escapeHtml(user.mobile)}
                </td>


                <td>
                  ${escapeHtml(user.role)}
                </td>


                <td>
                  ${renderCodes(user.sm_access)}
                </td>


                <td>
                  ${renderCodes(user.od_access)}
                </td>


                <td>

                  <span
                    class="raj-status ${
                      active
                        ? 'active'
                        : 'inactive'
                    }"
                  >
                    ${
                      active
                        ? 'Active'
                        : 'Inactive'
                    }
                  </span>

                </td>


                <td>

                  <span
                    class="raj-status ${
                      locked
                        ? 'locked'
                        : 'free'
                    }"
                  >
                    ${
                      locked
                        ? 'Locked'
                        : 'Available'
                    }
                  </span>

                </td>


                <td>
                  ${escapeHtml(
                    formatDate(
                      user.last_login_at
                    )
                  )}
                </td>


                <td>

                  <div class="raj-admin-actions">

                    <button
                      type="button"
                      class="raj-admin-secondary"
                      data-action="edit"
                      data-id="${escapeHtml(user.id)}"
                    >
                      Edit
                    </button>


                    <button
                      type="button"
                      class="raj-admin-warning"
                      data-action="password"
                      data-id="${escapeHtml(user.id)}"
                    >
                      Password
                    </button>


                    <button
                      type="button"
                      class="raj-admin-danger"
                      data-action="reset-device"
                      data-id="${escapeHtml(user.id)}"
                    >
                      Reset Device
                    </button>

                  </div>

                </td>

              </tr>

            `;

          }
        )
        .join('');


    body
      .querySelectorAll(
        '[data-action]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            () => {

              const user =
                adminUsers.find(
                  item =>
                    String(item.id)
                    ===
                    String(button.dataset.id)
                );


              if(!user){
                return;
              }


              const action =
                button.dataset.action;


              if(action === 'edit'){
                editUser(user);
              }


              if(action === 'password'){
                openPasswordPopup(user);
              }


              if(action === 'reset-device'){
                resetDevice(user);
              }

            }
          );

        }
      );

  }


  /* =========================================================
     ACCESS CHECKBOXES
     ========================================================= */

  function renderAccessOptions(){

    const smList =
      $('rajSmAccessList');

    const odList =
      $('rajOdAccessList');


    if(smList){

      smList.innerHTML =
        smOptions.length
          ? smOptions
              .map(
                code => `

                  <label class="raj-access-option">

                    <input
                      type="checkbox"
                      class="raj-sm-check"
                      value="${escapeHtml(code)}"
                    >

                    ${escapeHtml(code)}

                  </label>

                `
              )
              .join('')
          : '<div>No SM codes found.</div>';

    }


    if(odList){

      odList.innerHTML =
        odOptions.length
          ? odOptions
              .map(
                code => `

                  <label class="raj-access-option">

                    <input
                      type="checkbox"
                      class="raj-od-check"
                      value="${escapeHtml(code)}"
                    >

                    ${escapeHtml(code)}

                  </label>

                `
              )
              .join('')
          : '<div>No OD codes found.</div>';

    }

  }


  function getCheckedValues(selector){

    return Array
      .from(
        document.querySelectorAll(
          selector + ':checked'
        )
      )
      .map(
        input =>
          input.value
      );

  }


  function setCheckedValues(
    selector,
    values
  ){

    const selected =
      new Set(
        Array.isArray(values)
          ? values.map(String)
          : []
      );


    document
      .querySelectorAll(selector)
      .forEach(
        input => {

          input.checked =
            selected.has(
              String(input.value)
            );

        }
      );

  }


  /* =========================================================
     ADD / EDIT USER
     ========================================================= */

  function startAddUser(){

    editingUser = null;


    $('rajUserFormTitle').textContent =
      'Add New User';


    $('rajAdminName').value =
      '';


    $('rajAdminMobile').value =
      '';


    $('rajAdminRole').value =
      'SM';


    $('rajAdminPassword').value =
      '123456';


    $('rajAdminPassword').placeholder =
      'Minimum 6 characters';


    $('rajAdminActive').checked =
      true;


    $('rajAdminDeviceLock').checked =
      true;


    $('rajAdminFullView').checked =
      false;


    setCheckedValues(
      '.raj-sm-check',
      []
    );


    setCheckedValues(
      '.raj-od-check',
      []
    );


    updateRoleAccessVisibility();


    $('rajUserFormWrap')
      ?.classList
      .add('open');


    $('rajAdminName')
      ?.focus();

  }


  function editUser(user){

    editingUser =
      user;


    $('rajUserFormTitle').textContent =
      'Edit User - ' +
      String(user.name || '');


    $('rajAdminName').value =
      user.name || '';


    $('rajAdminMobile').value =
      user.mobile || '';


    $('rajAdminRole').value =
      user.role || 'SM';


    $('rajAdminPassword').value =
      '';


    $('rajAdminPassword').placeholder =
      'Leave blank to keep current password';


    $('rajAdminActive').checked =
      user.active === true;


    $('rajAdminDeviceLock').checked =
      user.device_lock_enabled !== false;


    $('rajAdminFullView').checked =
      user.full_view === true;


    setCheckedValues(
      '.raj-sm-check',
      user.sm_access
    );


    setCheckedValues(
      '.raj-od-check',
      user.od_access
    );


    updateRoleAccessVisibility();


    $('rajUserFormWrap')
      ?.classList
      .add('open');


    $('rajUserFormWrap')
      ?.scrollIntoView(
        {
          behavior:'smooth',
          block:'start'
        }
      );

  }


  function closeUserForm(){

    editingUser = null;


    $('rajUserFormWrap')
      ?.classList
      .remove('open');

  }


  function updateRoleAccessVisibility(){

    const role =
      $('rajAdminRole')
        ?.value
      || 'SM';


    const smBox =
      $('rajSmAccessBox');


    const odBox =
      $('rajOdAccessBox');


    if(smBox){

      smBox.style.display =
        (
          role === 'SM'
          ||
          role === 'SalesHead'
        )
          ? 'block'
          : 'none';

    }


    if(odBox){

      odBox.style.display =
        (
          role === 'OD'
          ||
          role === 'SalesHead'
        )
          ? 'block'
          : 'none';

    }


    if(
      role === 'Admin'
    ){

      $('rajAdminFullView').checked =
        true;

    }

  }


  async function saveUser(){

    const name =
      (
        $('rajAdminName')
          ?.value
        || ''
      ).trim();


    const mobile =
      (
        $('rajAdminMobile')
          ?.value
        || ''
      )
        .replace(/\D/g,'');


    const role =
      $('rajAdminRole')
        ?.value
      || 'SM';


    const password =
      $('rajAdminPassword')
        ?.value
      || '';


    if(!name){

      showMessage(
        'Please enter user name.',
        'error'
      );

      return;

    }


    if(mobile.length !== 10){

      showMessage(
        'Please enter valid 10 digit mobile number.',
        'error'
      );

      return;

    }


    if(
      !editingUser
      &&
      password.length < 6
    ){

      showMessage(
        'New user password must be at least 6 characters.',
        'error'
      );

      return;

    }


    const button =
      $('rajSaveUserBtn');


    if(button){

      button.disabled =
        true;

      button.textContent =
        'Saving...';

    }


    try{

      const params = {

        ...adminAuthParams(),

        p_user_id:
          editingUser
            ? editingUser.id
            : null,

        p_name:
          name,

        p_mobile:
          mobile,

        p_role:
          role,

        p_active:
          $('rajAdminActive')
            ?.checked === true,

        p_full_view:
          $('rajAdminFullView')
            ?.checked === true,

        p_device_lock_enabled:
          $('rajAdminDeviceLock')
            ?.checked === true,

        p_sm_access:
          (
            role === 'SM'
            ||
            role === 'SalesHead'
          )
            ? getCheckedValues(
                '.raj-sm-check'
              )
            : [],

        p_od_access:
          (
            role === 'OD'
            ||
            role === 'SalesHead'
          )
            ? getCheckedValues(
                '.raj-od-check'
              )
            : [],

        p_new_password:
          password.trim()
            ? password
            : null

      };


      const data =
        await rpc(
          'raj_admin_save_user',
          params
        );


      showMessage(
        data.message
        || 'User saved successfully.'
      );


      closeUserForm();


      await loadUsers();


    }catch(error){

      console.error(
        'Save user error:',
        error
      );


      showMessage(
        error.message
        || 'Unable to save user.',
        'error'
      );

    }finally{

      if(button){

        button.disabled =
          false;

        button.textContent =
          'Save User';

      }

    }

  }


  /* =========================================================
     RESET DEVICE
     ========================================================= */

  async function resetDevice(user){

    const confirmed =
      confirm(
        'Reset device for ' +
        user.name +
        ' (' +
        user.mobile +
        ')?\n\n' +
        'Their current login session will also be closed.'
      );


    if(!confirmed){
      return;
    }


    try{

      const data =
        await rpc(
          'raj_admin_reset_user_device',
          {
            ...adminAuthParams(),

            p_target_mobile:
              user.mobile
          }
        );


      showMessage(
        data.message
        || 'Device reset successfully.'
      );


      await loadUsers();


    }catch(error){

      console.error(
        'Reset device error:',
        error
      );


      showMessage(
        error.message
        || 'Unable to reset device.',
        'error'
      );

    }

  }


  /* =========================================================
     CHANGE PASSWORD
     ========================================================= */

  function openPasswordPopup(user){

    editingUser =
      user;


    $('rajPasswordUserText').textContent =
      (
        user.name
        + ' • '
        + user.mobile
      );


    $('rajNewPassword').value =
      '';


    $('rajPasswordOverlay')
      ?.classList
      .add('open');


    setTimeout(
      () =>
        $('rajNewPassword')
          ?.focus(),
      50
    );

  }


  function closePasswordPopup(){

    $('rajPasswordOverlay')
      ?.classList
      .remove('open');


    $('rajNewPassword').value =
      '';

  }


  async function submitPasswordChange(){

    if(!editingUser){
      return;
    }


    const password =
      $('rajNewPassword')
        ?.value
      || '';


    if(
      password.length < 6
    ){

      alert(
        'Password must be at least 6 characters.'
      );

      return;

    }


    const button =
      $('rajPasswordSave');


    if(button){

      button.disabled =
        true;

      button.textContent =
        'Changing...';

    }


    try{

      const data =
        await rpc(
          'raj_admin_change_user_password',
          {
            ...adminAuthParams(),

            p_target_mobile:
              editingUser.mobile,

            p_new_password:
              password
          }
        );


      closePasswordPopup();


      showMessage(
        data.message
        || 'Password changed successfully.'
      );


    }catch(error){

      console.error(
        'Password change error:',
        error
      );


      alert(
        error.message
        || 'Unable to change password.'
      );

    }finally{

      if(button){

        button.disabled =
          false;

        button.textContent =
          'Change Password';

      }

    }

  }


  /* =========================================================
     LOGIN LOGS
     ========================================================= */

  async function loadLoginLogs(){

    const loading =
      $('rajLogsLoading');

    const wrap =
      $('rajLogsTableWrap');


    if(loading){

      loading.style.display =
        'block';

      loading.textContent =
        'Loading login logs...';

    }


    if(wrap){
      wrap.style.display =
        'none';
    }


    try{

      const data =
        await rpc(
          'raj_admin_login_logs',
          {
            ...adminAuthParams(),
            p_limit:100
          }
        );


      renderLoginLogs(
        Array.isArray(data?.logs)
          ? data.logs
          : []
      );


      if(loading){
        loading.style.display =
          'none';
      }


      if(wrap){
        wrap.style.display =
          'block';
      }


    }catch(error){

      console.error(
        'Login logs error:',
        error
      );


      if(loading){

        loading.textContent =
          error.message
          || 'Unable to load login logs.';

      }

    }

  }


  function logStatusClass(status){

    const value =
      String(status || '')
        .toUpperCase();


    if(
      value === 'SUCCESS'
      ||
      value === 'LOGOUT'
    ){
      return 'raj-log-success';
    }


    if(
      value === 'BLOCKED_DEVICE'
    ){
      return 'raj-log-blocked';
    }


    return 'raj-log-failed';

  }


  function renderLoginLogs(logs){

    const body =
      $('rajLogsBody');


    if(!body){
      return;
    }


    if(
      !Array.isArray(logs)
      ||
      logs.length === 0
    ){

      body.innerHTML = `

        <tr>

          <td
            colspan="6"
            class="raj-admin-empty"
          >
            No login logs found.
          </td>

        </tr>

      `;

      return;

    }


    body.innerHTML =
      logs
        .map(
          log => `

            <tr>

              <td>
                ${escapeHtml(
                  formatDate(
                    log.created_at
                  )
                )}
              </td>


              <td>

                <div class="raj-admin-user-name">
                  ${escapeHtml(
                    log.name || '-'
                  )}
                </div>

              </td>


              <td>
                ${escapeHtml(
                  log.mobile || '-'
                )}
              </td>


              <td>

                <span class="${
                  logStatusClass(
                    log.login_status
                  )
                }">

                  ${escapeHtml(
                    log.login_status || '-'
                  )}

                </span>

              </td>


              <td>
                ${escapeHtml(
                  log.device_id || '-'
                )}
              </td>


              <td>
                ${escapeHtml(
                  log.details || '-'
                )}
              </td>

            </tr>

          `
        )
        .join('');

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  function initialize(){

    if(initialized){
      return;
    }


    initialized =
      true;


    addStyles();

    createAdminPanel();


    /*
      Auth addon creates #rajUserArea after login,
      so wait until it appears.
    */

    let attempts = 0;


    const timer =
      setInterval(
        () => {

          attempts++;


          const user =
            getStoredUser();


          if(
            isAdminUser(user)
          ){

            const created =
              createAdminButton();


            if(created){

              clearInterval(
                timer
              );

              return;

            }

          }


          if(
            attempts >= 240
          ){

            clearInterval(
              timer
            );

          }

        },
        250
      );

  }


  if(
    document.readyState ===
    'loading'
  ){

    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once:true
      }
    );

  }else{

    initialize();

  }


})();
