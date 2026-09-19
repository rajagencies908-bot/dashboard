/* ============================================================
   RAJ AGENCIES
   ADMIN USER MANAGEMENT ADDON
   Version: online21-delete-user

   Features:
   - Reliable Admin detection
   - Admin Panel button
   - User list
   - Add New User
   - Edit User
   - Mobile Number
   - Role
   - SM Access
   - OD Access
   - Active / Inactive
   - Full View
   - Device Lock ON / OFF
   - Change Password
   - Reset Device
   - Delete User
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

  let passwordUser = null;

  let initialized = false;


  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  const el = id =>
    document.getElementById(id);


  function escapeHtml(value){

    const div =
      document.createElement('div');

    div.textContent =
      String(value ?? '');

    return div.innerHTML;

  }


  function getSessionToken(){

    return (
      localStorage.getItem(
        SESSION_KEY
      )
      || ''
    );

  }


  function getDeviceId(){

    return (
      localStorage.getItem(
        DEVICE_KEY
      )
      || ''
    );

  }


  function getStoredUser(){

    try{

      const raw =
        localStorage.getItem(
          USER_KEY
        );


      if(!raw){
        return null;
      }


      const parsed =
        JSON.parse(raw);


      if(
        parsed
        &&
        parsed.user
        &&
        typeof parsed.user === 'object'
      ){
        return parsed.user;
      }


      return parsed;


    }catch(error){

      console.warn(
        'Unable to read stored user:',
        error
      );

      return null;

    }

  }


  function normalizeText(value){

    return String(
      value ?? ''
    )
      .trim()
      .toLowerCase();

  }


  /* =========================================================
     RELIABLE ADMIN DETECTION
     ========================================================= */

  function isAdminUser(){

    const user =
      getStoredUser();


    if(user){

      const role =
        normalizeText(
          user.role
        );


      if(
        role === 'admin'
        ||
        user.full_view === true
        ||
        user.fullView === true
      ){
        return true;
      }

    }


    const roleNode =
      document.querySelector(
        '.raj-user-role'
      );


    if(
      roleNode
      &&
      normalizeText(
        roleNode.textContent
      ).includes('admin')
    ){
      return true;
    }


    const accessBadge =
      el('rajAccessBadge');


    if(accessBadge){

      const badgeText =
        normalizeText(
          accessBadge.textContent
        );


      if(
        badgeText.includes('admin')
        ||
        badgeText.includes(
          'full company access'
        )
      ){
        return true;
      }

    }


    const userArea =
      el('rajUserArea');


    if(userArea){

      const areaText =
        normalizeText(
          userArea.textContent
        );


      if(
        areaText.includes('admin')
      ){
        return true;
      }

    }


    return false;

  }


  /* =========================================================
     DATE
     ========================================================= */

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


  /* =========================================================
     MESSAGE
     ========================================================= */

  function showMessage(
    message,
    type = 'success'
  ){

    const box =
      el('rajAdminMessage');


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

            box.textContent =
              '';

            box.className =
              'raj-admin-message';

          }

        },
        6000
      );

    }

  }


  /* =========================================================
     SUPABASE RPC
     ========================================================= */

  async function adminRpc(
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

      throw new Error(
        error.message
        ||
        'Supabase error.'
      );

    }


    if(
      data
      &&
      data.success === false
    ){

      throw new Error(
        data.message
        ||
        data.error
        ||
        'Operation failed.'
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
     STYLES
     ========================================================= */

  function addStyles(){

    if(
      el('rajAdminStyles')
    ){
      return;
    }


    const style =
      document.createElement(
        'style'
      );


    style.id =
      'rajAdminStyles';


    style.textContent = `

      /* ===============================================
         ADMIN PANEL BUTTON
         =============================================== */

      #rajAdminButton{

        border:0;

        cursor:pointer;

        padding:
          9px
          15px;

        border-radius:
          999px;

        color:#fff;

        background:
          linear-gradient(
            135deg,
            #4f46e5,
            #7c3aed
          );

        box-shadow:
          0 8px 20px
          rgba(79,70,229,.25);

        font-size:10px;
        font-weight:900;

        white-space:nowrap;

      }


      #rajAdminButton:hover{

        transform:
          translateY(-1px);

      }


      /* ===============================================
         MAIN OVERLAY
         =============================================== */

      #rajAdminOverlay{

        position:fixed;

        inset:0;

        z-index:999998;

        display:none;

        overflow:auto;

        padding:20px;

        background:
          rgba(15,23,42,.68);

        backdrop-filter:
          blur(8px);

        -webkit-backdrop-filter:
          blur(8px);

      }


      #rajAdminOverlay.open{

        display:block;

      }


      .raj-admin-shell{

        width:
          min(
            1450px,
            100%
          );

        min-height:
          calc(
            100vh - 40px
          );

        margin:
          0 auto;

        overflow:hidden;

        border-radius:
          24px;

        background:
          #f8fafc;

        box-shadow:
          0 30px 90px
          rgba(0,0,0,.30);

      }


      /* ===============================================
         HEADER
         =============================================== */

      .raj-admin-header{

        display:flex;

        align-items:center;

        justify-content:
          space-between;

        gap:15px;

        padding:
          20px
          23px;

        color:#fff;

        background:
          linear-gradient(
            135deg,
            #312e81,
            #5b21b6,
            #7e22ce
          );

      }


      .raj-admin-header h2{

        margin:
          0
          0
          4px;

        font-size:
          22px;

        font-weight:
          900;

      }






            .raj-admin-header p{

        margin:0;

        opacity:.85;

        font-size:
          11px;

      }


      #rajAdminClose{

        width:40px;

        height:40px;

        border:0;

        border-radius:
          50%;

        cursor:pointer;

        color:#fff;

        background:
          rgba(
            255,
            255,
            255,
            .16
          );

        font-size:
          22px;

      }


      /* ===============================================
         TOOLBAR
         =============================================== */

      .raj-admin-toolbar{

        display:flex;

        flex-wrap:wrap;

        gap:9px;

        padding:
          15px
          20px;

        border-bottom:
          1px solid
          #e2e8f0;

        background:#fff;

      }


      .raj-admin-toolbar button{

        border:
          1px solid
          #ddd6fe;

        border-radius:
          10px;

        cursor:pointer;

        padding:
          9px
          14px;

        color:
          #5b21b6;

        background:
          #f5f3ff;

        font-size:
          11px;

        font-weight:
          850;

      }


      .raj-admin-toolbar button.active{

        border-color:
          #6d28d9;

        color:#fff;

        background:
          #6d28d9;

      }


      /* ===============================================
         CONTENT
         =============================================== */

      .raj-admin-content{

        padding:
          20px;

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

        justify-content:
          space-between;

        flex-wrap:wrap;

        gap:12px;

        margin-bottom:
          15px;

      }


      .raj-admin-section-head h3{

        margin:0;

        color:
          #17213c;

        font-size:
          18px;

        font-weight:
          900;

      }


      /* ===============================================
         MESSAGE
         =============================================== */

      .raj-admin-message{

        min-height:
          20px;

        margin:
          12px
          20px
          0;

        font-size:
          12px;

        font-weight:
          850;

      }


      .raj-admin-message.success{

        color:
          #15803d;

      }


      .raj-admin-message.error{

        color:
          #b91c1c;

      }


      /* ===============================================
         BUTTONS
         =============================================== */

      .raj-admin-primary{

        border:0;

        border-radius:
          10px;

        cursor:pointer;

        padding:
          10px
          14px;

        color:#fff;

        background:
          linear-gradient(
            135deg,
            #4f46e5,
            #7c3aed
          );

        font-size:
          11px;

        font-weight:
          900;

      }


      .raj-admin-secondary{

        border:
          1px solid
          #cbd5e1;

        border-radius:
          9px;

        cursor:pointer;

        padding:
          8px
          11px;

        color:
          #334155;

        background:
          #fff;

        font-size:
          10px;

        font-weight:
          850;

      }


      .raj-admin-warning{

        border:
          1px solid
          #fde68a;

        border-radius:
          9px;

        cursor:pointer;

        padding:
          8px
          11px;

        color:
          #92400e;

        background:
          #fffbeb;

        font-size:
          10px;

        font-weight:
          850;

      }


      .raj-admin-danger{

        border:
          1px solid
          #fecdd3;

        border-radius:
          9px;

        cursor:pointer;

        padding:
          8px
          11px;

        color:
          #be123c;

        background:
          #fff1f2;

        font-size:
          10px;

        font-weight:
          850;

      }


      button:disabled{

        opacity:.55;

        cursor:not-allowed;

      }


      /* ===============================================
         USER FORM
         =============================================== */

      .raj-admin-form{

        display:none;

        margin-bottom:
          20px;

        padding:
          18px;

        border:
          1px solid
          #ddd6fe;

        border-radius:
          16px;

        background:#fff;

      }


      .raj-admin-form.open{

        display:block;

      }


      .raj-admin-form-title{

        margin:
          0
          0
          15px;

        color:
          #312e81;

        font-size:
          16px;

        font-weight:
          900;

      }


      .raj-admin-grid{

        display:grid;

        grid-template-columns:
          repeat(
            auto-fit,
            minmax(
              210px,
              1fr
            )
          );

        gap:
          14px;

      }


      .raj-admin-field label{

        display:block;

        margin-bottom:
          6px;

        color:
          #475569;

        font-size:
          10px;

        font-weight:
          900;

      }


      .raj-admin-field input,
      .raj-admin-field select{

        width:100%;

        min-height:
          42px;

        padding:
          0
          11px;

        box-sizing:
          border-box;

        border:
          1px solid
          #cbd5e1;

        border-radius:
          10px;

        outline:none;

        background:#fff;

        color:
          #17213c;

        font-size:
          12px;

      }


      .raj-admin-field input:focus,
      .raj-admin-field select:focus{

        border-color:
          #7c3aed;

        box-shadow:
          0 0 0 3px
          rgba(
            124,
            58,
            237,
            .10
          );

      }


      .raj-admin-checks{

        display:flex;

        flex-wrap:wrap;

        gap:
          16px;

        margin-top:
          16px;

      }


      .raj-admin-check{

        display:flex;

        align-items:center;

        gap:
          7px;

        color:
          #334155;

        font-size:
          11px;

        font-weight:
          800;

      }


      .raj-admin-check input{

        width:
          17px;

        height:
          17px;

      }


      /* ===============================================
         ACCESS BOXES
         =============================================== */

      .raj-access-box{

        margin-top:
          15px;

        padding:
          14px;

        border:
          1px solid
          #e2e8f0;

        border-radius:
          13px;

        background:
          #f8fafc;

      }


      .raj-access-box h4{

        margin:
          0
          0
          10px;

        color:
          #334155;

        font-size:
          11px;

        font-weight:
          900;

      }


      .raj-access-list{

        display:grid;

        grid-template-columns:
          repeat(
            auto-fill,
            minmax(
              80px,
              1fr
            )
          );

        gap:
          7px;

        max-height:
          190px;

        overflow:auto;

      }


      .raj-access-option{

        display:flex;

        align-items:center;

        gap:
          6px;

        padding:
          7px
          8px;

        border:
          1px solid
          #e2e8f0;

        border-radius:
          9px;

        background:#fff;

        color:
          #334155;

        font-size:
          10px;

        font-weight:
          800;

      }


      /* ===============================================
         FORM ACTIONS
         =============================================== */

      .raj-admin-form-actions{

        display:flex;

        flex-wrap:wrap;

        gap:9px;

        margin-top:
          17px;

      }




            }


      /* ===============================================
         TABLE
         =============================================== */

      .raj-admin-table-wrap{

        width:100%;

        overflow:auto;

        border:
          1px solid
          #e2e8f0;

        border-radius:
          14px;

        background:#fff;

      }


      .raj-admin-table{

        width:100%;

        min-width:
          1100px;

        border-collapse:
          collapse;

      }


      .raj-admin-table th{

        padding:
          12px
          10px;

        position:
          sticky;

        top:0;

        z-index:1;

        border-bottom:
          1px solid
          #e2e8f0;

        background:
          #f8fafc;

        color:
          #475569;

        text-align:left;

        white-space:
          nowrap;

        font-size:
          10px;

        font-weight:
          900;

      }


      .raj-admin-table td{

        padding:
          11px
          10px;

        border-bottom:
          1px solid
          #f1f5f9;

        vertical-align:
          top;

        color:
          #334155;

        font-size:
          11px;

      }


      .raj-admin-user-name{

        color:
          #17213c;

        font-weight:
          900;

      }


      .raj-admin-actions{

        display:flex;

        flex-wrap:wrap;

        gap:
          5px;

      }


      /* ===============================================
         CODE BADGES
         =============================================== */

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

        border-radius:
          999px;

        color:
          #6d28d9;

        background:
          #ede9fe;

        font-size:
          9px;

        font-weight:
          850;

      }


      /* ===============================================
         STATUS BADGES
         =============================================== */

      .raj-status{

        display:inline-block;

        padding:
          4px
          8px;

        border-radius:
          999px;

        font-size:
          9px;

        font-weight:
          900;

      }


      .raj-status.active{

        color:
          #166534;

        background:
          #dcfce7;

      }


      .raj-status.inactive{

        color:
          #991b1b;

        background:
          #fee2e2;

      }


      .raj-status.locked{

        color:
          #92400e;

        background:
          #fef3c7;

      }


      .raj-status.available{

        color:
          #166534;

        background:
          #dcfce7;

      }


      /* ===============================================
         LOADING
         =============================================== */

      .raj-admin-loading,
      .raj-admin-empty{

        padding:
          25px;

        text-align:
          center;

        color:
          #64748b;

        font-size:
          12px;

        font-weight:
          800;

      }


      /* ===============================================
         LOGIN LOG COLORS
         =============================================== */

      .raj-log-success{

        color:
          #15803d;

        font-weight:
          900;

      }


      .raj-log-blocked{

        color:
          #b45309;

        font-weight:
          900;

      }


      .raj-log-failed{

        color:
          #b91c1c;

        font-weight:
          900;

      }


      /* ===============================================
         PASSWORD POPUP
         =============================================== */

      #rajPasswordOverlay{

        position:fixed;

        inset:0;

        z-index:
          1000000;

        display:none;

        align-items:center;

        justify-content:center;

        padding:
          20px;

        background:
          rgba(
            15,
            23,
            42,
            .75
          );

      }


      #rajPasswordOverlay.open{

        display:flex;

      }


      .raj-password-box{

        width:
          min(
            420px,
            100%
          );

        padding:
          22px;

        box-sizing:
          border-box;

        border-radius:
          18px;

        background:#fff;

        box-shadow:
          0 25px 70px
          rgba(
            0,
            0,
            0,
            .28
          );

      }


      .raj-password-box h3{

        margin:
          0
          0
          5px;

        color:
          #17213c;

      }


      .raj-password-box p{

        margin:
          0
          0
          16px;

        color:
          #64748b;

        font-size:
          11px;

      }


      /* ===============================================
         MOBILE
         =============================================== */

      @media(
        max-width:700px
      ){

        #rajAdminOverlay{

          padding:7px;

        }


        .raj-admin-shell{

          min-height:
            calc(
              100vh - 14px
            );

          border-radius:
            15px;

        }


        .raj-admin-header{

          padding:
            16px;

        }


        .raj-admin-content{

          padding:
            12px;

        }


        #rajAdminButton{

          padding:
            7px
            10px;

        }

      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* =========================================================
     CREATE ADMIN PANEL BUTTON
     ========================================================= */

  function createAdminButton(){

    if(
      !isAdminUser()
    ){
      return false;
    }


    if(
      el('rajAdminButton')
    ){
      return true;
    }


    const userArea =
      el('rajUserArea');


    if(userArea){

      const button =
        document.createElement(
          'button'
        );


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


    const topbar =
      document.querySelector(
        '.topbar'
      );


    if(topbar){

      const button =
        document.createElement(
          'button'
        );


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


      topbar.appendChild(
        button
      );


      return true;

    }


    return false;

  }


  /* =========================================================
     CREATE ADMIN PANEL HTML
     ========================================================= */

  function createAdminPanel(){

    if(
      el('rajAdminOverlay')
    ){
      return;
    }


    const overlay =
      document.createElement(
        'div'
      );


    overlay.id =
      'rajAdminOverlay';


    overlay.innerHTML = `

      <div class="raj-admin-shell">

        <div class="raj-admin-header">

          <div>

            <h2>
              Admin User Management
            </h2>

            <p>
              Manage users, mobile numbers, roles, access, passwords and devices
            </p>

          </div>


          <button
            type="button"
            id="rajAdminClose"
            title="Close Admin Panel"
          >
            ×
          </button>

        </div>


        <div class="raj-admin-toolbar">

          <button
            type="button"
            class="raj-admin-tab active"
            data-tab="users"
          >
            Users
          </button>


          <button
            type="button"
            class="raj-admin-tab"
            data-tab="logs"
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

          <section
            id="rajUsersSection"
            class="raj-admin-section active"
          >


            <div class="raj-admin-section-head">

              <h3>
                Users
              </h3>


              <button
                type="button"
                id="rajAddUser"
                class="raj-admin-primary"
              >
                + Add New User
              </button>

            </div>


            <div
              id="rajUserForm"
              class="raj-admin-form"
            >


              <h4
                id="rajUserFormTitle"
                class="raj-admin-form-title"
              >
                Add New User
              </h4>


              <div class="raj-admin-grid">


                <div class="raj-admin-field">

                  <label>
                    Name
                  </label>

                  <input
                    type="text"
                    id="rajAdminName"
                    placeholder="Enter user name"
                  >

                </div>


                <div class="raj-admin-field">

                  <label>
                    Mobile Number
                  </label>

                  <input
                    type="tel"
                    inputmode="numeric"
                    maxlength="10"
                    id="rajAdminMobile"
                    placeholder="10 digit mobile number"
                  >

                </div>


                <div class="raj-admin-field">

                  <label>
                    Role
                  </label>

                  <select
                    id="rajAdminRole"
                  >

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
                    placeholder="Minimum 6 characters"
                  >

                </div>

              </div>


              <div class="raj-admin-checks">

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
                id="rajSmBox"
                class="raj-access-box"
              >

                <h4>
                  SM Access
                </h4>

                <div
                  id="rajSmList"
                  class="raj-access-list"
                ></div>

              </div>


              <div
                id="rajOdBox"
                class="raj-access-box"
              >

                <h4>
                  OD Access
                </h4>

                <div
                  id="rajOdList"
                  class="raj-access-list"
                ></div>

              </div>


              <div class="raj-admin-form-actions">

                <button
                  type="button"
                  id="rajSaveUser"
                  class="raj-admin-primary"
                >
                  Save User
                </button>


                <button
                  type="button"
                  id="rajCancelUser"
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

                    <th>Name</th>

                    <th>Mobile</th>

                    <th>Role</th>

                    <th>SM Access</th>

                    <th>OD Access</th>

                    <th>Status</th>

                    <th>Device Lock</th>

                    <th>Device</th>

                    <th>Last Login</th>

                    <th>Actions</th>

                  </tr>

                </thead>


                <tbody
                  id="rajUsersBody"
                ></tbody>

              </table>

            </div>

          </section>


          <section
            id="rajLogsSection"
            class="raj-admin-section"
          >


            <div class="raj-admin-section-head">

              <h3>
                Login Logs
              </h3>


              <button
                type="button"
                id="rajRefreshLogs"
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


                <tbody
                  id="rajLogsBody"
                ></tbody>

              </table>

            </div>

          </section>

        </div>

      </div>


      <div
        id="rajPasswordOverlay"
      >

        <div class="raj-password-box">

          <h3>
            Change Password
          </h3>


          <p
            id="rajPasswordUser"
          ></p>


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

      </div>

    `;


    document.body.appendChild(
      overlay
    );


    wireAdminPanel();

  }


  /* =========================================================
     PANEL EVENTS
     ========================================================= */

  function wireAdminPanel(){

    el('rajAdminClose')
      ?.addEventListener(
        'click',
        closeAdminPanel
      );


    el('rajAddUser')
      ?.addEventListener(
        'click',
        openAddUser
      );


    el('rajCancelUser')
      ?.addEventListener(
        'click',
        closeUserForm
      );


    el('rajSaveUser')
      ?.addEventListener(
        'click',
        saveUser
      );


    el('rajAdminRole')
      ?.addEventListener(
        'change',
        updateRoleUI
      );


    el('rajPasswordSave')
      ?.addEventListener(
        'click',
        changePassword
      );


    el('rajPasswordCancel')
      ?.addEventListener(
        'click',
        closePasswordPopup
      );


    el('rajRefreshLogs')
      ?.addEventListener(
        'click',
        loadLoginLogs
      );


    el('rajAdminRefresh')
      ?.addEventListener(
        'click',
        async () => {

          await loadUsers();

          if(
            el('rajLogsSection')
              ?.classList
              .contains('active')
          ){

            await loadLoginLogs();

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
                button.dataset.tab
              );

            }
          );

        }
      );

  }


  /* =========================================================
     OPEN / CLOSE PANEL
     ========================================================= */

  async function openAdminPanel(){

    if(
      !isAdminUser()
    ){

      alert(
        'Admin access required.'
      );

      return;

    }


    el('rajAdminOverlay')
      ?.classList
      .add('open');


    await loadUsers();

  }


  function closeAdminPanel(){

    el('rajAdminOverlay')
      ?.classList
      .remove('open');

    closeUserForm();

    closePasswordPopup();

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
            button.dataset.tab === tab
          );

        }
      );


    el('rajUsersSection')
      ?.classList
      .toggle(
        'active',
        tab === 'users'
      );


    el('rajLogsSection')
      ?.classList
      .toggle(
        'active',
        tab === 'logs'
      );


    if(
      tab === 'logs'
    ){

      loadLoginLogs();

    }

  }


  /* =========================================================
     LOAD USERS
     ========================================================= */

  async function loadUsers(){

    const loading =
      el('rajUsersLoading');

    const table =
      el('rajUsersTableWrap');


    if(loading){

      loading.style.display =
        'block';

      loading.textContent =
        'Loading users...';

    }


    if(table){

      table.style.display =
        'none';

    }


    try{

      const data =
        await adminRpc(
          'raj_admin_list_users',
          adminAuthParams()
        );


      adminUsers =
        Array.isArray(
          data?.users
        )
          ? data.users
          : [];


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

      renderUsers();


      if(loading){

        loading.style.display =
          'none';

      }


      if(table){

        table.style.display =
          'block';

      }


    }catch(error){

      console.error(
        'Load users error:',
        error
      );


      if(loading){

        loading.textContent =
          error.message
          ||
          'Unable to load users.';

      }

    }

  }


  /* =========================================================
     ACCESS OPTIONS
     ========================================================= */

  function renderAccessOptions(){

    const smList =
      el('rajSmList');

    const odList =
      el('rajOdList');


    if(smList){

      smList.innerHTML =
        smOptions
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
          .join('');

    }


    if(odList){

      odList.innerHTML =
        odOptions
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
          .join('');

    }

  }


  /* =========================================================
     BADGES
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
        value => `

          <span class="raj-admin-code">
            ${escapeHtml(value)}
          </span>

        `
      )
      .join('');

  }


  /* =========================================================
     RENDER USERS
     ========================================================= */

  function renderUsers(){

    const body =
      el('rajUsersBody');


    if(!body){
      return;
    }


    if(
      !Array.isArray(adminUsers)
      ||
      adminUsers.length === 0
    ){

      body.innerHTML = `

        <tr>

          <td
            colspan="10"
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
          user => `

            <tr>

              <td>

                <div class="raj-admin-user-name">
                  ${escapeHtml(
                    user.name || '-'
                  )}
                </div>

              </td>


              <td>
                ${escapeHtml(
                  user.mobile || '-'
                )}
              </td>


              <td>
                ${escapeHtml(
                  user.role || '-'
                )}
              </td>


              <td>
                ${renderCodes(
                  user.sm_access
                )}
              </td>


              <td>
                ${renderCodes(
                  user.od_access
                )}
              </td>


              <td>

                <span
                  class="raj-status ${
                    user.active === true
                      ? 'active'
                      : 'inactive'
                  }"
                >

                  ${
                    user.active === true
                      ? 'Active'
                      : 'Inactive'
                  }

                </span>

              </td>


              <td>

                ${
                  user.device_lock_enabled
                  !== false

                    ? `
                      <span class="raj-status locked">
                        ON
                      </span>
                    `

                    : `
                      <span class="raj-status available">
                        OFF
                      </span>
                    `
                }

              </td>


              <td>

                ${
                  user.device_id

                    ? escapeHtml(
                        user.device_id
                      )

                    : `
                      <span class="raj-status available">
                        Available
                      </span>
                    `
                }

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
                    data-user-id="${escapeHtml(
                      user.id
                    )}"
                  >
                    Edit
                  </button>


                  <button
                    type="button"
                    class="raj-admin-warning"
                    data-action="password"
                    data-user-id="${escapeHtml(
                      user.id
                    )}"
                  >
                    Password
                  </button>


                  <button
                    type="button"
                    class="raj-admin-danger"
                    data-action="reset"
                    data-user-id="${escapeHtml(
                      user.id
                    )}"
                  >
                    Reset Device
                  </button>


                  <button
                    type="button"
                    class="raj-admin-danger"
                    data-action="delete"
                    data-user-id="${escapeHtml(
                      user.id
                    )}"
                  >
                    🗑 Delete
                  </button>


                </div>

              </td>

            </tr>

          `
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
                    String(
                      button.dataset.userId
                    )
                );


              if(!user){
                return;
              }


              const action =
                button.dataset.action;


              if(
                action === 'edit'
              ){

                openEditUser(
                  user
                );

              }


              if(
                action === 'password'
              ){

                openPasswordPopup(
                  user
                );

              }


              if(
                action === 'reset'
              ){

                resetDevice(
                  user
                );

              }


              if(
                action === 'delete'
              ){

                deleteUser(
                  user
                );

              }

            }
          );

        }
      );

  }






   /* =========================================================
     CHECKBOX HELPERS
     ========================================================= */

  function getCheckedValues(selector){

    return Array
      .from(
        document.querySelectorAll(
          selector + ':checked'
        )
      )
      .map(
        item =>
          item.value
      );

  }


  function setCheckedValues(
    selector,
    values
  ){

    const set =
      new Set(
        Array.isArray(values)
          ? values.map(
              value =>
                String(value)
            )
          : []
      );


    document
      .querySelectorAll(
        selector
      )
      .forEach(
        checkbox => {

          checkbox.checked =
            set.has(
              String(
                checkbox.value
              )
            );

        }
      );

  }


  /* =========================================================
     LOAD ACCESS OPTIONS
     ========================================================= */

  async function loadAccessOptions(){

    try{

      const data =
        await adminRpc(
          'raj_admin_access_options',
          adminAuthParams()
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
        'Access option error:',
        error
      );


      showMessage(
        error.message
        ||
        'Unable to load SM / OD access options.',
        'error'
      );

    }

  }


  /* =========================================================
     ADD USER
     ========================================================= */

  function openAddUser(){

    editingUser =
      null;


    if(
      el('rajUserFormTitle')
    ){

      el('rajUserFormTitle')
        .textContent =
        'Add New User';

    }


    if(
      el('rajAdminName')
    ){

      el('rajAdminName').value =
        '';

    }


    if(
      el('rajAdminMobile')
    ){

      el('rajAdminMobile').value =
        '';

    }


    if(
      el('rajAdminRole')
    ){

      el('rajAdminRole').value =
        'SM';

    }


    /*
       Default initial password.
    */
    if(
      el('rajAdminPassword')
    ){

      el('rajAdminPassword').value =
        '123456';

      el('rajAdminPassword').placeholder =
        'Minimum 6 characters';

    }


    if(
      el('rajAdminActive')
    ){

      el('rajAdminActive').checked =
        true;

    }


    if(
      el('rajAdminDeviceLock')
    ){

      el('rajAdminDeviceLock').checked =
        true;

    }


    if(
      el('rajAdminFullView')
    ){

      el('rajAdminFullView').checked =
        false;

    }


    setCheckedValues(
      '.raj-sm-check',
      []
    );


    setCheckedValues(
      '.raj-od-check',
      []
    );


    updateRoleUI();


    el('rajUserForm')
      ?.classList
      .add('open');


    el('rajAdminName')
      ?.focus();

  }


  /* =========================================================
     EDIT USER
     ========================================================= */

  function openEditUser(user){

    editingUser =
      user;


    if(
      el('rajUserFormTitle')
    ){

      el('rajUserFormTitle')
        .textContent =
        'Edit User - ' +
        String(
          user.name || ''
        );

    }


    if(
      el('rajAdminName')
    ){

      el('rajAdminName').value =
        user.name || '';

    }


    if(
      el('rajAdminMobile')
    ){

      el('rajAdminMobile').value =
        user.mobile || '';

    }


    if(
      el('rajAdminRole')
    ){

      el('rajAdminRole').value =
        user.role || 'SM';

    }


    if(
      el('rajAdminPassword')
    ){

      el('rajAdminPassword').value =
        '';

      el('rajAdminPassword').placeholder =
        'Leave blank to keep current password';

    }


    if(
      el('rajAdminActive')
    ){

      el('rajAdminActive').checked =
        user.active === true;

    }


    if(
      el('rajAdminDeviceLock')
    ){

      el('rajAdminDeviceLock').checked =
        user.device_lock_enabled
        !== false;

    }


    if(
      el('rajAdminFullView')
    ){

      el('rajAdminFullView').checked =
        user.full_view === true;

    }


    setCheckedValues(
      '.raj-sm-check',
      user.sm_access
    );


    setCheckedValues(
      '.raj-od-check',
      user.od_access
    );


    updateRoleUI();


    el('rajUserForm')
      ?.classList
      .add('open');


    el('rajUserForm')
      ?.scrollIntoView(
        {
          behavior:'smooth',
          block:'start'
        }
      );

  }


  function closeUserForm(){

    editingUser =
      null;


    el('rajUserForm')
      ?.classList
      .remove('open');

  }


  /* =========================================================
     ROLE UI
     ========================================================= */

  function updateRoleUI(){

    const role =
      el('rajAdminRole')
        ?.value
      ||
      'SM';


    const smBox =
      el('rajSmBox');


    const odBox =
      el('rajOdBox');


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
      &&
      el('rajAdminFullView')
    ){

      el('rajAdminFullView')
        .checked =
        true;

    }

  }


  /* =========================================================
     SAVE USER
     ========================================================= */

  async function saveUser(){

    const name =
      (
        el('rajAdminName')
          ?.value
        ||
        ''
      ).trim();


    const mobile =
      (
        el('rajAdminMobile')
          ?.value
        ||
        ''
      )
        .replace(
          /\D/g,
          ''
        );


    const role =
      el('rajAdminRole')
        ?.value
      ||
      'SM';


    const password =
      el('rajAdminPassword')
        ?.value
      ||
      '';


    if(!name){

      showMessage(
        'User name required.',
        'error'
      );

      return;

    }


    if(
      mobile.length !== 10
    ){

      showMessage(
        'Mobile number must be 10 digits.',
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
        'Password must be at least 6 characters.',
        'error'
      );

      return;

    }


    const button =
      el('rajSaveUser');


    if(button){

      button.disabled =
        true;

      button.textContent =
        'Saving...';

    }


    try{

      const smAccess =
        (
          role === 'SM'
          ||
          role === 'SalesHead'
        )
          ? getCheckedValues(
              '.raj-sm-check'
            )
          : [];


      const odAccess =
        (
          role === 'OD'
          ||
          role === 'SalesHead'
        )
          ? getCheckedValues(
              '.raj-od-check'
            )
          : [];


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
          el('rajAdminActive')
            ?.checked === true,

        p_full_view:
          el('rajAdminFullView')
            ?.checked === true,

        p_device_lock_enabled:
          el('rajAdminDeviceLock')
            ?.checked === true,

        p_sm_access:
          smAccess,

        p_od_access:
          odAccess,

        p_new_password:
          password.trim()
            ? password
            : null

      };


      const data =
        await adminRpc(
          'raj_admin_save_user',
          params
        );


      showMessage(
        data?.message
        ||
        'User saved successfully.'
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
        ||
        'Unable to save user.',
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
     DELETE USER - online21
     ========================================================= */

  async function deleteUser(user){

    if(
      !user
      ||
      !user.id
    ){

      showMessage(
        'User information not found.',
        'error'
      );

      return;

    }


    /*
       First confirmation.
    */
    const confirmed =
      window.confirm(
        'DELETE USER?\n\n' +
        String(
          user.name || ''
        ) +
        ' (' +
        String(
          user.mobile || ''
        ) +
        ')\n\n' +
        'This will permanently delete:\n' +
        '• User account\n' +
        '• SM access\n' +
        '• OD access\n' +
        '• Active device session\n\n' +
        'Login Logs will be kept.\n\n' +
        'Are you sure?'
      );


    if(!confirmed){
      return;
    }


    /*
       Second confirmation protects against
       accidental deletion.
    */
    const confirmedAgain =
      window.confirm(
        'FINAL CONFIRMATION\n\n' +
        'Permanently delete ' +
        String(
          user.name || ''
        ) +
        '?\n\n' +
        'This action cannot be undone.'
      );


    if(!confirmedAgain){
      return;
    }


    try{

      showMessage(
        'Deleting ' +
        String(
          user.name || 'user'
        ) +
        '...'
      );


      /*
         IMPORTANT:
         raj_admin_delete_user SQL created in Supabase
         accepts session token + user id.

         Admin authorization is checked again
         inside the database function.
      */
      const data =
        await adminRpc(
          'raj_admin_delete_user',
          {

            p_admin_session_token:
              getSessionToken(),

            p_user_id:
              user.id

          }
        );


      showMessage(
        data?.message
        ||
        (
          String(
            user.name || 'User'
          )
          +
          ' deleted successfully.'
        )
      );


      /*
         If deleted user was currently open
         in Edit form, close the form.
      */
      if(
        editingUser
        &&
        String(
          editingUser.id
        )
        ===
        String(
          user.id
        )
      ){

        closeUserForm();

      }


      /*
         Refresh table immediately.
      */
      await loadUsers();


    }catch(error){

      console.error(
        'Delete user error:',
        error
      );


      showMessage(
        error.message
        ||
        'Unable to delete user.',
        'error'
      );

    }

  }


  /* =========================================================
     RESET DEVICE
     ========================================================= */

  async function resetDevice(user){

    const confirmed =
      window.confirm(
        'Reset device for ' +
        String(
          user.name || ''
        ) +
        ' (' +
        String(
          user.mobile || ''
        ) +
        ')?\n\n' +
        'Current active session will also be closed.'
      );


    if(!confirmed){
      return;
    }


    try{

      const data =
        await adminRpc(
          'raj_admin_reset_user_device',
          {

            ...adminAuthParams(),

            p_target_mobile:
              user.mobile

          }
        );


      showMessage(
        data?.message
        ||
        'Device reset successfully.'
      );


      await loadUsers();


    }catch(error){

      console.error(
        'Reset device error:',
        error
      );


      showMessage(
        error.message
        ||
        'Unable to reset device.',
        'error'
      );

    }

  }


  /* =========================================================
     PASSWORD POPUP
     ========================================================= */

  function openPasswordPopup(user){

    passwordUser =
      user;


    if(
      el('rajPasswordUser')
    ){

      el('rajPasswordUser')
        .textContent =
        String(
          user.name || ''
        )
        +
        ' • '
        +
        String(
          user.mobile || ''
        );

    }


    if(
      el('rajNewPassword')
    ){

      el('rajNewPassword').value =
        '';

    }


    el('rajPasswordOverlay')
      ?.classList
      .add('open');


    setTimeout(
      () => {

        el('rajNewPassword')
          ?.focus();

      },
      50
    );

  }


  function closePasswordPopup(){

    passwordUser =
      null;


    if(
      el('rajNewPassword')
    ){

      el('rajNewPassword').value =
        '';

    }


    el('rajPasswordOverlay')
      ?.classList
      .remove('open');

  }


  /* =========================================================
     CHANGE PASSWORD
     ========================================================= */

  async function changePassword(){

    if(
      !passwordUser
    ){
      return;
    }


    const newPassword =
      el('rajNewPassword')
        ?.value
      ||
      '';


    if(
      newPassword.length < 6
    ){

      alert(
        'Password must be at least 6 characters.'
      );

      return;

    }


    const button =
      el('rajPasswordSave');


    if(button){

      button.disabled =
        true;

      button.textContent =
        'Changing...';

    }


    try{

      const data =
        await adminRpc(
          'raj_admin_change_user_password',
          {

            ...adminAuthParams(),

            p_target_mobile:
              passwordUser.mobile,

            p_new_password:
              newPassword

          }
        );


      const message =
        data?.message
        ||
        'Password changed successfully.';


      closePasswordPopup();


      showMessage(
        message
      );


      await loadUsers();


    }catch(error){

      console.error(
        'Password change error:',
        error
      );


      alert(
        error.message
        ||
        'Unable to change password.'
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
      el('rajLogsLoading');


    const table =
      el('rajLogsTableWrap');


    if(loading){

      loading.style.display =
        'block';

      loading.textContent =
        'Loading login logs...';

    }


    if(table){

      table.style.display =
        'none';

    }


    try{

      const data =
        await adminRpc(
          'raj_admin_login_logs',
          {

            ...adminAuthParams(),

            p_limit:
              100

          }
        );


      const logs =
        Array.isArray(
          data?.logs
        )
          ? data.logs
          : [];


      renderLogs(
        logs
      );


      if(loading){

        loading.style.display =
          'none';

      }


      if(table){

        table.style.display =
          'block';

      }


    }catch(error){

      console.error(
        'Login log error:',
        error
      );


      if(loading){

        loading.textContent =
          error.message
          ||
          'Unable to load login logs.';

      }

    }

  }


  function getLogClass(status){

    const value =
      String(
        status || ''
      )
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


  function renderLogs(logs){

    const body =
      el('rajLogsBody');


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
                  getLogClass(
                    log.login_status
                  )
                }">

                  ${escapeHtml(
                    log.login_status
                    ||
                    '-'
                  )}

                </span>

              </td>


              <td>
                ${escapeHtml(
                  log.device_id
                  ||
                  '-'
                )}
              </td>


              <td>
                ${escapeHtml(
                  log.details
                  ||
                  '-'
                )}
              </td>

            </tr>

          `
        )
        .join('');

  }


  /* =========================================================
     MOBILE NUMBER INPUT
     ========================================================= */

  function wireMobileInput(){

    el('rajAdminMobile')
      ?.addEventListener(
        'input',
        event => {

          event.target.value =
            event.target.value
              .replace(
                /\D/g,
                ''
              )
              .slice(
                0,
                10
              );

        }
      );

  }


  /* =========================================================
     ADMIN REFRESH
     ========================================================= */

  function wireRefreshButton(){

    el('rajAdminRefresh')
      ?.addEventListener(
        'click',
        async () => {

          try{

            await Promise.all([
              loadAccessOptions(),
              loadUsers()
            ]);


            showMessage(
              'Admin data refreshed.'
            );


          }catch(error){

            console.error(
              'Admin refresh error:',
              error
            );

          }

        }
      );

  }


  /* =========================================================
     KEEP ADMIN BUTTON AVAILABLE
     ========================================================= */

  function maintainAdminButton(){

    if(
      isAdminUser()
    ){

      createAdminButton();

    }else{

      const existing =
        el('rajAdminButton');


      if(existing){

        existing.remove();

      }

    }

  }


  /* =========================================================
     EXTRA PANEL EVENTS
     ========================================================= */

  function wireExtraAdminEvents(){

    wireMobileInput();

    wireRefreshButton();


    /*
       Clicking dark background closes panel.
    */
    el('rajAdminOverlay')
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


    /*
       Escape closes password popup first,
       otherwise Admin panel.
    */
    document.addEventListener(
      'keydown',
      event => {

        if(
          event.key !== 'Escape'
        ){
          return;
        }


        if(
          el('rajPasswordOverlay')
            ?.classList
            .contains('open')
        ){

          closePasswordPopup();

          return;

        }


        if(
          el('rajAdminOverlay')
            ?.classList
            .contains('open')
        ){

          closeAdminPanel();

        }

      }
    );

  }


  /* =========================================================
     STORAGE CHANGE SUPPORT
     ========================================================= */

  window.addEventListener(
    'storage',
    event => {

      if(
        event.key === USER_KEY
        ||
        event.key === SESSION_KEY
      ){

        setTimeout(
          maintainAdminButton,
          50
        );

      }

    }
  );


  /* =========================================================
     PAGE SHOW SUPPORT
     ========================================================= */

  window.addEventListener(
    'pageshow',
    () => {

      setTimeout(
        maintainAdminButton,
        300
      );

    }
  );


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


    wireExtraAdminEvents();


    /*
       Load access options in background so
       Add/Edit form has SM and OD choices.
    */
    if(
      getSessionToken()
      &&
      getDeviceId()
      &&
      isAdminUser()
    ){

      loadAccessOptions()
        .catch(
          error => {

            console.warn(
              'Initial access option load:',
              error
            );

          }
        );

    }


    /*
       auth-addon.js validates login asynchronously,
       therefore check Admin button repeatedly.
    */
    maintainAdminButton();


    setTimeout(
      maintainAdminButton,
      250
    );


    setTimeout(
      maintainAdminButton,
      750
    );


    setTimeout(
      maintainAdminButton,
      1500
    );


    setTimeout(
      maintainAdminButton,
      3000
    );


    setInterval(
      maintainAdminButton,
      1000
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
