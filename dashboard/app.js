// Config and State
const CSV_URL = '/api/data';
let allVehicles = [];
let currentFilter = 'all';
let currentStatusFilter = 'all';

// DOM Elements
const els = {
    // Buttons and Inputs
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    destinationFilters: document.getElementById('destinationFilters'),
    
    // Containers
    loadingIndicator: document.getElementById('loadingIndicator'),
    vehiclesContainer: document.getElementById('vehiclesContainer'),
    noResultsMsg: document.getElementById('noResultsMsg'),
    
    // Dynamic Text Elements
    currentViewTitle: document.getElementById('currentViewTitle'),
    lastUpdate: document.getElementById('lastUpdate'),
    
    // KPIs
    kpiTotal: document.getElementById('kpi-total'),
    kpiRejected: document.getElementById('kpi-rejected'),
    kpiPending: document.getElementById('kpi-pending'),
    kpiReprocess: document.getElementById('kpi-reprocess'),
    kpiAccepted: document.getElementById('kpi-accepted'),
    kpiSinEstado: document.getElementById('kpi-sinestado'),
    
    // Percentages
    pctRejected: document.getElementById('pct-rejected'),
    pctPending: document.getElementById('pct-pending'),
    pctReprocess: document.getElementById('pct-reprocess'),
    pctAccepted: document.getElementById('pct-accepted'),
    pctSinEstado: document.getElementById('pct-sinestado'),
    
    // Modal
    modal: document.getElementById('vehicleModal'),
    closeBtn: document.querySelector('.close-btn'),
};

// Initialize App
document.addEventListener('DOMContentLoaded', init);

function init() {
    loadData();
    setupEventListeners();
}

function setupEventListeners() {
    // Refresh button
    els.refreshBtn.addEventListener('click', loadData);
    
    // Search input
    els.searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        renderVehicles(currentFilter, term);
    });
    
    // Category Filters
    els.destinationFilters.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            // Update active styling
            document.querySelectorAll('#destinationFilters li').forEach(li => li.classList.remove('active'));
            e.target.classList.add('active');
            
            // Apply filter
            currentFilter = e.target.getAttribute('data-dest');
            
            // Set Titles
            els.currentViewTitle.textContent = `Mostrando: ${e.target.textContent}`;
            
            // Clear search when switching tabs for better UX
            els.searchInput.value = '';
            
            renderVehicles(currentFilter, ''); // render logic handles status filters naturally
        }
    });

    // KPI Card Click Filters
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Update active styling
            document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            // Apply status filter
            currentStatusFilter = card.getAttribute('data-filter');
            
            // Clear search when switching tabs for better UX
            els.searchInput.value = '';
            
            renderVehicles(currentFilter, '');
        });
    });

    // Modal Close
    els.closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === els.modal) closeModal();
    });
}

function loadData() {
    showLoading(true);
    els.lastUpdate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Solicitando a Servidor...`;
    
    // Fetch desde el Servidor Edge de Vercel
    fetch(CSV_URL)
        .then(response => {
            if (!response.ok) throw new Error('Error en el servidor Vercel');
            return response.text();
        })
        .then(csvText => {
            parseCSVData(csvText);
        })
        .catch(error => {
            console.error('Error fetching CSV from API:', error);
            alert('Fallo de conexión en la Nube. Intenta recargar la página.');
            showLoading(false);
            els.lastUpdate.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> Error en nube`;
        });
}

function parseCSVData(csvText) {
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: function(results) {
            processVehicles(results.data);
            els.lastUpdate.innerHTML = `<i class="fa-regular fa-clock"></i> Última act: ${new Date().toLocaleTimeString()}`;
            showLoading(false);
        },
        error: function(error) {
            console.error('PapaParse Error:', error);
            showLoading(false);
        }
    });
}

function processVehicles(data) {
    allVehicles = data.map(row => {
        // Safe access helper
        const getVal = (key) => row[key] ? row[key].trim() : '';
        
        // Extraemos valores directos en MAYUSCULAS
        const entregaRevo = getVal('ENTREGA-REVO Y ESSA').toUpperCase();
        const revRevoEssa = getVal('REVISION-REVO Y ESSA').toUpperCase();
        const obsRevoEssa = getVal('OBSERVACION - REVO Y ESSA').toUpperCase();
        
        const entregaEmsa = getVal('ENTREGA-EMSA Y ASSA').toUpperCase();
        const revEmsaAssa = getVal('REVISION-EMSA Y ASSA').toUpperCase();
        const obsEmsaAssa = getVal('OBSERVACION - EMSA Y ASSA').toUpperCase();
        
        // Bloque de Revisiones
        const textoRevision = `${revRevoEssa} ${obsRevoEssa} ${revEmsaAssa} ${obsEmsaAssa}`;
        
        // Bloque de Entregas
        const tieneEntrega = (entregaRevo.includes('ENTREGA') || entregaEmsa.includes('ENTREGA'));

        let status = 'SIN ESTADO';
        
        // PRIORIDAD 1 Absoluta: Si CUALQUIER zona tiene RECHAZADO o ACEPTADO, prima eso ante todo.
        if (textoRevision.includes('RECHAZADO')) {
            status = 'RECHAZADO';
        }
        else if (textoRevision.includes('ACEPTADO')) {
            status = 'ACEPTADO';
        }
        else {
            // PRIORIDAD 2: Pendientes de Revisión
            // Si tiene una N-sima entrega (en cualquier zona) y NO fue ni aceptado ni rechazado
            if (tieneEntrega) {
                status = 'PENDIENTE DE REVISIÓN';
            }
            else {
                // PRIORIDAD 3: Reprocesos Puros
                // Ya filtramos Todo Aceptado, Rechazado, y Entregas.
                const estadoCC = getVal('Estado CC').toUpperCase();
                
                if (estadoCC === 'REPROCESO') {
                    status = 'EN REPROCESO';
                } else {
                    status = 'SIN ESTADO'; // Resto que no cumple nada
                }
            }
        }
        
        // Cleanup destination for grouping
        let rawDest = getVal('Destino').toUpperCase();
        let groupDest = 'OTROS';
        
        if (rawDest.includes('DESPACHO')) groupDest = 'DESPACHO';
        else if (rawDest.includes('EMSA')) groupDest = 'ZONA EMSA';
        else if (rawDest.includes('ESSA')) groupDest = 'ZONA ESSA';
        else if (rawDest.includes('REVO')) groupDest = 'ZONA REVO';
        else if (rawDest.includes('AASA') || rawDest.includes('ASSA')) groupDest = 'ZONA AASA';

        // Get explicit Rejection Observation (Col W or Z)
        // Note: Headers derived from the CSV structure
        const obsRevoFinal = getVal('OBSERVACION - REVO Y ESSA');
        const obsEmsaFinal = getVal('OBSERVACION - EMSA Y ASSA');
        const rejectionReason = obsRevoFinal ? obsRevoFinal : obsEmsaFinal;

        return {
            raw: row, // Keep raw row for modal
            vin: getVal('VIN'),
            modelo: getVal('MODELO'),
            color: getVal('COLOR'),
            destino: getVal('Destino'),
            dealer: getVal('DEALER'),
            groupDest: groupDest,
            status: status,
            estadoCC: getVal('Estado CC'),
            reprocesoFalta: getVal('QUE REPROCESO FALTA'),
            taller: getVal('TALLER'),
            rejectionReason: rejectionReason
        };
    }).filter(v => v.vin); // Only keep valid rows with VIN

    updateKPIs(allVehicles);
    renderVehicles(currentFilter, '');
}

function updateKPIs(vehicles) {
    const total = vehicles.length;
    els.kpiTotal.textContent = total;
    
    const setGroupData = (statusStr, kpiEl, pctEl) => {
        const count = vehicles.filter(v => v.status === statusStr).length;
        if (kpiEl) kpiEl.textContent = count;
        if (pctEl) {
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0.0;
            pctEl.textContent = `(${parseFloat(pct)}%)`;
        }
    };

    setGroupData('RECHAZADO', els.kpiRejected, els.pctRejected);
    setGroupData('ACEPTADO', els.kpiAccepted, els.pctAccepted);
    setGroupData('EN REPROCESO', els.kpiReprocess, els.pctReprocess);
    setGroupData('PENDIENTE DE REVISIÓN', els.kpiPending, els.pctPending);
    setGroupData('SIN ESTADO', els.kpiSinEstado, els.pctSinEstado);
}

function renderVehicles(destFilter, searchTerm) {
    els.vehiclesContainer.innerHTML = '';
    
    // Sort logic (Prioritize rules defined by user)
    // Dest Order: DESPACHO > ZONA ESSA > ZONA REVO > Others (handled by the sidebar buttons easily)
    // Within list prioritizing: RECHAZADOs first, then Pending, then Reproceso, Aceptados last to get them out of the way.
    const statusWeight = {
        'RECHAZADO': 1,
        'PENDIENTE DE REVISIÓN': 2,
        'EN REPROCESO': 3,
        'ACEPTADO': 4,
        'SIN ESTADO': 5
    };

    let filtered = allVehicles.filter(v => {
        let matchDest = (destFilter === 'all') || (v.groupDest === destFilter);
        let matchStatus = (currentStatusFilter === 'all') || (v.status === currentStatusFilter);
        
        let matchSearch = true;
        if (searchTerm) {
            // Search by full VIN or last 6 logic
            const vinLower = v.vin.toLowerCase();
            const vinLast6 = vinLower.slice(-6);
            matchSearch = vinLower.includes(searchTerm) || vinLast6.includes(searchTerm);
        }
        
        return matchDest && matchStatus && matchSearch;
    });

    // Sort heavily by status to put priority items first
    filtered.sort((a, b) => statusWeight[a.status] - statusWeight[b.status]);

    if (filtered.length === 0) {
        els.vehiclesContainer.classList.add('hidden');
        els.noResultsMsg.classList.remove('hidden');
    } else {
        els.vehiclesContainer.classList.remove('hidden');
        els.noResultsMsg.classList.add('hidden');
        
        filtered.forEach(v => {
            const card = document.createElement('div');
            card.className = `vehicle-card`;
            card.setAttribute('data-status', v.status);
            
            // Format Badge Color
            let badgeClass = 'badge-info';
            if(v.status === 'RECHAZADO') badgeClass = 'badge-danger';
            if(v.status === 'ACEPTADO') badgeClass = 'badge-success';
            if(v.status === 'EN REPROCESO') badgeClass = 'badge-alert';
            if(v.status === 'PENDIENTE DE REVISIÓN') badgeClass = 'badge-warning';
            if(v.status === 'SIN ESTADO') badgeClass = 'badge-info';

            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${v.vin}</h3>
                        <p class="card-subtitle">${v.modelo} - ${v.color}</p>
                    </div>
                    <span class="badge ${badgeClass}">${v.status}</span>
                </div>
                <div class="card-body">
                    <p><span class="label">Destino Real:</span> <span class="value">${v.destino || '-'}</span></p>
                    <p><span class="label">Dealer:</span> <span class="value">${v.dealer || '-'}</span></p>
                    ${v.status === 'RECHAZADO' && v.rejectionReason ? `<p><span class="label text-danger">Motivo Rechazo:</span> <span class="value text-danger" title="${v.rejectionReason}">${v.rejectionReason}</span></p>` : ''}
                    ${v.status === 'EN REPROCESO' ? `<p><span class="label text-danger">Falta:</span> <span class="value">${v.reprocesoFalta}</span></p>` : ''}
                </div>
            `;
            
            card.addEventListener('click', () => openModal(v));
            els.vehiclesContainer.appendChild(card);
        });
    }
}

function openModal(v) {
    const raw = v.raw;
    const getVal = (key) => raw[key] ? raw[key].trim() : '-';
    
    // Header
    document.getElementById('modalVin').innerHTML = `VIN: <span>${v.vin}</span>`;
    document.getElementById('modalModelColor').textContent = `${v.modelo} - ${v.color}`;
    
    // Status Badge
    const badge = document.getElementById('modalStatusBadge');
    badge.textContent = v.status;
    badge.className = 'badge'; // reset
    if(v.status === 'RECHAZADO') badge.classList.add('badge-danger');
    else if(v.status === 'ACEPTADO') badge.classList.add('badge-success');
    else if(v.status === 'EN REPROCESO') badge.classList.add('badge-alert');
    else if(v.status === 'PENDIENTE DE REVISIÓN') badge.classList.add('badge-warning');
    else badge.classList.add('badge-info');
    
    // Info Group 1
    document.getElementById('mDestino').textContent = getVal('Destino');
    document.getElementById('mDealer').textContent = getVal('DEALER');
    document.getElementById('mUbi').textContent = getVal('UBICACIÓN ESUM');
    document.getElementById('mTaller').textContent = getVal('TALLER');
    
    // Info Group 2
    document.getElementById('mPreparado').textContent = getVal('REALIZADO');
    document.getElementById('mEstadoCC').textContent = getVal('Estado CC');
    document.getElementById('mEntregaASSA').textContent = getVal('ENTREGA-EMSA Y ASSA');
    document.getElementById('mRevASSA').textContent = getVal('REVISION-EMSA Y ASSA') + " " + getVal('OBSERVACION - EMSA Y ASSA');
    document.getElementById('mEntregaREVO').textContent = getVal('ENTREGA-REVO Y ESSA');
    document.getElementById('mRevREVO').textContent = getVal('REVISION-REVO Y ESSA');
    
    // Info Group 3: Reprocess
    const reproGroup = document.getElementById('reprocessGroup');
    const reproFalta = getVal('QUE REPROCESO FALTA');
    const rpPintura = getVal('REPROCESO PINTURA');
    const rpRepuesto = getVal('REPROCESO REPUESTOS');
    const obsRevo = getVal('OBSERVACION - REVO Y ESSA');
    
    if (reproFalta !== '-' || rpPintura !== '-' || rpRepuesto !== '-') {
        reproGroup.classList.remove('hidden');
        document.getElementById('mQueFalta').textContent = reproFalta;
        document.getElementById('mPintura').textContent = rpPintura;
        document.getElementById('mRepuestos').textContent = rpRepuesto;
        document.getElementById('mObsFinal').textContent = obsRevo !== '-' ? obsRevo : getVal('OBSERVACION - EMSA Y ASSA');
    } else {
        reproGroup.classList.add('hidden');
    }

    els.modal.classList.remove('hidden');
}

function closeModal() {
    els.modal.classList.add('hidden');
}

function showLoading(isLoading) {
    if (isLoading) {
        els.loadingIndicator.classList.remove('hidden');
        els.vehiclesContainer.classList.add('hidden');
        els.noResultsMsg.classList.add('hidden');
    } else {
        els.loadingIndicator.classList.add('hidden');
    }
}
