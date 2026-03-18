// Config and State
const CSV_URL = '/api/data';
let allVehicles = [];
let currentFilter = 'all';
let currentStatusFilter = 'all';
let currentReprocesoFilter = 'all'; // 'all', 'REPUESTO', or 'PINTURA'
let currentUbiFilters = [];         // Array of selected ESUM locations
let availableUbis = new Set();      // Complete dictionary of unique locations

// DOM Elements
const els = {
    // Buttons and Inputs
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    destinationFilters: document.getElementById('destinationFilters'),
    qrBtn: document.getElementById('qrBtn'),
    closeQrBtn: document.getElementById('closeQrBtn'),
    
    // Ubicación ESUM Dropdown
    ubiDropdownBtn: document.getElementById('ubiDropdownBtn'),
    ubiDropdownMenu: document.getElementById('ubiDropdownMenu'),
    ubiClearBtn: document.getElementById('ubiClearBtn'),
    ubiCheckboxList: document.getElementById('ubiCheckboxList'),
    ubiCountBadge: document.getElementById('ubiCountBadge'),
    
    // Reproceso Filters
    reprocesoFilters: document.getElementById('reprocesoFilters'),

    // Containers
    loadingIndicator: document.getElementById('loadingIndicator'),
    vehiclesContainer: document.getElementById('vehiclesContainer'),
    noResultsMsg: document.getElementById('noResultsMsg'),
    qrReaderContainer: document.getElementById('qr-reader-container'),

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
let html5QrcodeScanner = null;
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

    // QR Code Scanner controls
    els.qrBtn.addEventListener('click', startQrScanner);
    els.closeQrBtn.addEventListener('click', stopQrScanner);

    // Ubicación ESUM Dropdown Logic
    els.ubiDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        els.ubiDropdownMenu.classList.toggle('hidden');
    });

    window.addEventListener('click', (e) => {
        if (!els.ubiDropdownBtn.contains(e.target) && !els.ubiDropdownMenu.contains(e.target)) {
            els.ubiDropdownMenu.classList.add('hidden');
        }
    });

    els.ubiClearBtn.addEventListener('click', () => {
        currentUbiFilters = [];
        document.querySelectorAll('.ubi-checkbox').forEach(cb => cb.checked = false);
        updateUbiBadge();
        renderVehicles(currentFilter, els.searchInput.value.trim().toLowerCase());
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

            // Reset reproceso filter
            currentReprocesoFilter = 'all';
            updateReprocesoButtons();
            
            // Show/hide reproceso sub-filters
            if (currentStatusFilter === 'RECHAZADO' || currentStatusFilter === 'EN REPROCESO') {
                els.reprocesoFilters.classList.remove('hidden');
            } else {
                els.reprocesoFilters.classList.add('hidden');
            }

            // Clear search when switching tabs for better UX
            els.searchInput.value = '';

            renderVehicles(currentFilter, '');
        });
    });
    
    // Reproceso Sub-filter Buttons
    document.querySelectorAll('.btn-reproceso').forEach(btn => {
        btn.addEventListener('click', () => {
            currentReprocesoFilter = btn.getAttribute('data-reproceso');
            updateReprocesoButtons();
            renderVehicles(currentFilter, els.searchInput.value.trim().toLowerCase());
        });
    });

    // Modal Close
    els.closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === els.modal) closeModal();
    });
}

function startQrScanner() {
    els.qrReaderContainer.classList.remove('hidden');
    
    // Initialize scanner if not exists
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: {width: 250, height: 250} },
            /* verbose= */ false);
            
        html5QrcodeScanner.render((decodedText, decodedResult) => {
            // Success Callback
            stopQrScanner();
            
            // Clean read text (sometime QR codes have prefixes)
            const cleanVin = decodedText.trim();
            els.searchInput.value = cleanVin;
            
            // Trigger search
            renderVehicles(currentFilter, cleanVin.toLowerCase());
        }, (errorMessage) => {
            // parse error, ignore it.
        });
    }
}

function stopQrScanner() {
    els.qrReaderContainer.classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner. ", error);
        });
        html5QrcodeScanner = null;
    }
}

function updateReprocesoButtons() {
    document.querySelectorAll('.btn-reproceso').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-reproceso') === currentReprocesoFilter);
    });
}

function buildUbiCheckboxes() {
    els.ubiCheckboxList.innerHTML = '';
    const sortedUbis = Array.from(availableUbis).filter(Boolean).sort();
    
    sortedUbis.forEach(ubi => {
        const item = document.createElement('label');
        item.className = 'dropdown-item';
        
        const isChecked = currentUbiFilters.includes(ubi) ? 'checked' : '';
        
        item.innerHTML = `
            <input type="checkbox" class="ubi-checkbox" value="${ubi}" ${isChecked}>
            <span>${ubi}</span>
        `;
        
        const cb = item.querySelector('input');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!currentUbiFilters.includes(ubi)) currentUbiFilters.push(ubi);
            } else {
                currentUbiFilters = currentUbiFilters.filter(u => u !== ubi);
            }
            updateUbiBadge();
            renderVehicles(currentFilter, els.searchInput.value.trim().toLowerCase());
        });
        
        els.ubiCheckboxList.appendChild(item);
    });
}

function updateUbiBadge() {
    if (currentUbiFilters.length > 0) {
        els.ubiCountBadge.textContent = currentUbiFilters.length;
        els.ubiCountBadge.classList.remove('hidden');
    } else {
        els.ubiCountBadge.classList.add('hidden');
    }
}

function loadData() {
    showLoading(true);
    els.lastUpdate.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Solicitando a Servidor...`;

    // Fetch desde el Servidor Edge de Vercel
    fetch(CSV_URL)
        .then(response => {
            if (!response.ok) throw new Error('Error en el servidor Vercel');
            return response.json(); // Ahora esperamos un JSON con 5 CSVs
        })
        .then(jsonPayload => {
            parseAllData(jsonPayload);
        })
        .catch(error => {
            console.error('Error fetching data from API:', error);
            showLoading(false);
            els.lastUpdate.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> Error Nube`;
            els.vehiclesContainer.innerHTML = `
                <div class="no-results">
                    <i class="fa-solid fa-cloud-bolt text-danger"></i>
                    <h3>Error de Conexión</h3>
                    <p>Google o el servidor tardaron demasiado. Intenta recargar en un minuto.</p>
                </div>
            `;
            els.vehiclesContainer.classList.remove('hidden');
        });
}

function parseAllData(payload) {
    // 1. Array de promesas para parsear cada CSV individual
    const parsePromises = [];

    // Master CSV con headers
    parsePromises.push(new Promise(resolve => {
        Papa.parse(payload.master, {
            header: true, skipEmptyLines: true, dynamicTyping: false,
            complete: res => resolve({ key: 'master', data: res.data })
        });
    }));

    // CSVs Secundarios SIN headers (para usar índices fijos)
    const secondaryKeys = ['emsa_entregas', 'emsa_revision', 'revo_entregas', 'revo_revision'];
    secondaryKeys.forEach(key => {
        parsePromises.push(new Promise(resolve => {
            Papa.parse(payload[key] || "", {
                header: false, skipEmptyLines: true, dynamicTyping: false,
                complete: res => resolve({ key: key, data: res.data })
            });
        }));
    });

    Promise.all(parsePromises).then(results => {
        // Convertir el array de resultados a un objeto manejable
        const parsed = {};
        results.forEach(r => parsed[r.key] = r.data);
        
        buildLookupsAndProcess(parsed);
    }).catch(err => {
        console.error('Error parseando CSVs:', err);
        showLoading(false);
        els.lastUpdate.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i> Error JS`;
        els.vehiclesContainer.innerHTML = `
            <div class="no-results" style="text-align: left; padding: 2rem; background: #fee2e2; border-radius: 8px;">
                <i class="fa-solid fa-bug text-danger" style="font-size: 2rem;"></i>
                <h3 class="text-danger" style="margin-top: 1rem;">Crash en Tabla</h3>
                <p><strong>Razón:</strong> ${err.message}</p>
                <div style="margin-top: 1rem; padding: 1rem; background: #fff; border: 1px solid #fca5a5; font-size: 0.8rem; overflow-x: auto;">
                    ${err.stack || 'Sin Stack Trace'}
                </div>
            </div>
        `;
        els.vehiclesContainer.classList.remove('hidden');
    });
}

function buildLookupsAndProcess(parsedData) {
    // Diccionarios para cruzar la data rápidamente usando el VIN como llave
    const dictEmsa = {};
    const dictRevo = {};

    // Helper para procesar Entregas
    // arr: array bidimensional (filas/columnas)
    // dict: el diccionario a llenar
    // idxVin: indice de col para VIN (B -> 1)
    // idxFecha: indice de col para fecha (A -> 0)
    // idxEntrega: indice de col para nro entrega (P -> 15 o O -> 14)
    const processEntregas = (arr, dict, idxVin, idxFecha, idxEntrega) => {
        // Asumimos que la fila 0 y 1 podrían ser encabezados visuales, por lo que saltamos las primeras filas si no parece un VIN
        arr.forEach(row => {
            if (row.length < Math.max(idxVin, idxEntrega) + 1) return;
            const vin = row[idxVin] ? row[idxVin].toString().trim() : "";
            if (!vin || vin.length < 5) return; // Validación básica de VIN

            if (!dict[vin]) dict[vin] = { entregaDate: "", entregaNum: "", status: "", obs: "", revDate: "" };
            dict[vin].entregaDate = row[idxFecha] ? row[idxFecha].toString().trim() : "";
            dict[vin].entregaNum = row[idxEntrega] ? row[idxEntrega].toString().trim() : "";
            
            // Artificial string para emular logica anterior
            dict[vin].oldLogicEntregaStr = `ENTREGA ${dict[vin].entregaNum}`;
        });
    };

    // Helper para procesar Revisiones
    // idxEstado: (E -> 4)
    // idxObs: (F -> 5)
    const processRevisiones = (arr, dict, idxVin, idxFecha, idxEstado, idxObs) => {
        arr.forEach(row => {
            if (row.length < Math.max(idxVin, idxEstado) + 1) return;
            const vin = row[idxVin] ? row[idxVin].toString().trim() : "";
            if (!vin || vin.length < 5) return;

            if (!dict[vin]) dict[vin] = { entregaDate: "", entregaNum: "", status: "", obs: "", revDate: "" };
            dict[vin].revDate = row[idxFecha] ? row[idxFecha].toString().trim() : "";
            dict[vin].status = row[idxEstado] ? row[idxEstado].toString().trim().toUpperCase() : "";
            dict[vin].obs = row[idxObs] ? row[idxObs].toString().trim() : "";
            
            // Artificial string para emular logica anterior
            dict[vin].oldLogicRevisionStr = `${dict[vin].status} ${dict[vin].obs}`;
        });
    };

    // Llenamos diccionarios (procesamiento hacia abajo, el último sobreescribe y queda como vigente)
    // EMSA (VIN: Col B(1), Fecha Col A(0), Entrega Col P(15))
    processEntregas(parsedData.emsa_entregas, dictEmsa, 1, 0, 15);
    // EMSA Revisiones (VIN: Col B(1), Fecha Col A(0), Estado Col E(4), Obs Col F(5))
    processRevisiones(parsedData.emsa_revision, dictEmsa, 1, 0, 4, 5);

    // REVO (VIN: Col B(1), Fecha Col A(0), Entrega Col O(14))
    processEntregas(parsedData.revo_entregas, dictRevo, 1, 0, 14);
    // REVO Revisiones (VIN: Col B(1), Fecha Col A(0), Estado Col E(4), Obs Col F(5))
    processRevisiones(parsedData.revo_revision, dictRevo, 1, 0, 4, 5);

    // Finalmente mandamos los vehículos originales y los diccionarios al procesador principal
    processVehicles(parsedData.master, dictEmsa, dictRevo);
    
    // UI Update final
    els.lastUpdate.innerHTML = `<i class="fa-regular fa-clock"></i> Última act: ${new Date().toLocaleTimeString()}`;
    showLoading(false);
}

function processVehicles(data, dictEmsa, dictRevo) {
    allVehicles = data.map(row => {
        // Safe access helper
        const getVal = (key) => row[key] ? row[key].trim() : '';

        const vin = getVal('VIN');
        if (!vin) return null;

        // Cleanup destination for grouping
        let rawDest = getVal('Destino').toUpperCase();
        let groupDest = 'OTROS';

        if (rawDest.includes('DESPACHO')) groupDest = 'DESPACHO';
        else if (rawDest.includes('EMSA')) groupDest = 'ZONA EMSA';
        else if (rawDest.includes('ESSA')) groupDest = 'ZONA ESSA';
        else if (rawDest.includes('REVO')) groupDest = 'ZONA REVO';
        else if (rawDest.includes('AASA') || rawDest.includes('ASSA')) groupDest = 'ZONA AASA';

        // Determinar qué diccionario usar según el destino
        const isRevoEssa = (groupDest === 'ZONA REVO' || groupDest === 'ZONA ESSA');
        const activeDictInfo = isRevoEssa ? (dictRevo[vin] || {}) : (dictEmsa[vin] || {});

        // Extraemos valores simulados para la lógica de estados
        const entregaStr = activeDictInfo.oldLogicEntregaStr || "";
        const revisionStr = activeDictInfo.oldLogicRevisionStr || "";

        // Bloque de Entregas y Revisiones
        const textoRevision = revisionStr.toUpperCase();
        const tieneEntrega = entregaStr.includes('ENTREGA');

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
            if (tieneEntrega) {
                status = 'PENDIENTE DE REVISIÓN';
            }
            else {
                // PRIORIDAD 3: Reprocesos Puros
                const estadoCC = getVal('Estado CC').toUpperCase();

                if (estadoCC === 'REPROCESO') {
                    status = 'EN REPROCESO';
                } else {
                    status = 'SIN ESTADO';
                }
            }
        }

        // Observación de rechazo directa del dict
        const rejectionReason = activeDictInfo.obs || '';
        
        // Reproceso details for sub-filtering (Aún vienen del maestro)
        const rpPintura = getVal('REPROCESO PINTURA');
        const rpRepuestos = getVal('REPROCESO REPUESTOS');
        
        // Determine reproceso type flags
        const tieneRepuestoPendiente = rpRepuestos !== '' && rpRepuestos.toUpperCase() !== 'OK' && rpRepuestos !== '-';
        const tienePinturaPendiente = rpPintura !== '' && rpPintura.toUpperCase() !== 'OK' && rpPintura !== '-';

        // Calculate Delta Rejection Time if RECHAZADO
        let rejectionDeltaStr = '-';
        let isCriticalRejection = false;

        if (status === 'RECHAZADO' && activeDictInfo.revDate) {
            // "16/03/2026 15:30:00" -> Parse this Google Sheet date format
            try {
                // Remove weird chars if any
                const cleanDate = activeDictInfo.revDate.trim();
                
                // Assuming format DD/MM/YYYY HH:mm:ss or similar from Sheets
                // Simple parsing (split by space, then split by / and :)
                const parts = cleanDate.split(' ');
                if (parts.length >= 2) {
                    const dPart = parts[0].split('/');
                    const tPart = parts[1].split(':');
                    
                    if (dPart.length === 3 && tPart.length >= 2) {
                        // JS Date needs YYYY, MM (0-11), DD, HH, MM
                        const revD = new Date(dPart[2], parseInt(dPart[1])-1, dPart[0], tPart[0], tPart[1]);
                        
                        const now = new Date(); // Local Time from browser
                        const diffMs = now - revD;
                        
                        // Si diffMs es negativa (fechas futuras mal puestas), ignora
                        if (diffMs > 0) {
                            const diffHrs = (diffMs / (1000 * 60 * 60));
                            
                            isCriticalRejection = diffHrs > 3; // +3 hours = Red
                            
                            if (diffHrs < 24) {
                                rejectionDeltaStr = `${Math.floor(diffHrs)} hrs`;
                            } else {
                                const diffDays = diffHrs / 24;
                                rejectionDeltaStr = `${Math.floor(diffDays)} días`;
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Fecha no parseable:', activeDictInfo.revDate);
            }
        }

        return {
            raw: row, // Keep raw row for modal
            extraInfo: activeDictInfo, // Guardar la data cruzada para el modal
            vin: vin,
            modelo: getVal('MODELO'),
            color: getVal('COLOR'),
            ubicacionEsum: ubicacionEsum,
            destino: getVal('Destino'),
            dealer: getVal('DEALER'),
            groupDest: groupDest,
            status: status,
            estadoCC: getVal('Estado CC'),
            reprocesoFalta: getVal('QUE REPROCESO FALTA'),
            taller: getVal('TALLER'),
            rejectionReason: rejectionReason,
            rejectionDeltaStr: rejectionDeltaStr,
            isCriticalRejection: isCriticalRejection,
            rpPintura: rpPintura,
            rpRepuestos: rpRepuestos,
            tieneRepuestoPendiente: tieneRepuestoPendiente,
            tienePinturaPendiente: tienePinturaPendiente
        };
    }).filter(v => v !== null); // Only keep valid rows with VIN

    buildUbiCheckboxes();
    updateKPIs(allVehicles);
    renderVehicles(currentFilter, els.searchInput.value.trim().toLowerCase());
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
        
        // Reproceso sub-filter
        let matchReproceso = true;
        if (currentReprocesoFilter === 'REPUESTO') {
            matchReproceso = v.tieneRepuestoPendiente;
        } else if (currentReprocesoFilter === 'PINTURA') {
            matchReproceso = v.tienePinturaPendiente;
        }

        // Ubicacion ESUM sub-filter
        let matchUbi = true;
        if (currentUbiFilters.length > 0) {
            matchUbi = currentUbiFilters.includes(v.ubicacionEsum);
        }

        let matchSearch = true;
        if (searchTerm) {
            const vinLower = v.vin.toLowerCase();
            const vinLast6 = vinLower.slice(-6);
            matchSearch = vinLower.includes(searchTerm) || vinLast6.includes(searchTerm);
        }

        return matchDest && matchStatus && matchSearch && matchReproceso && matchUbi;
    });

    // Sort by status priority
    filtered.sort((a, b) => statusWeight[a.status] - statusWeight[b.status]);

    if (filtered.length === 0) {
        els.vehiclesContainer.classList.add('hidden');
        els.noResultsMsg.classList.remove('hidden');
    } else {
        els.vehiclesContainer.classList.remove('hidden');
        els.noResultsMsg.classList.add('hidden');
        
        // Determine which extra column to show based on current status filter
        const showReprocesoCol = (currentStatusFilter === 'EN REPROCESO' || currentStatusFilter === 'all');
        const showRechazoCol = (currentStatusFilter === 'RECHAZADO' || currentStatusFilter === 'all');
        
        // Build TABLE
        let tableHTML = `
            <table class="vehicles-table">
                <thead>
                    <tr>
                        <th style="color:var(--danger)">Delta Rechazo</th>
                        <th>VIN</th>
                        <th>Modelo</th>
                        <th>Color</th>
                        <th>Ubicación ESUM</th>
                        <th>Estado</th>
                        <th>Destino</th>
                        <th>Dealer</th>
                        <th>Estado CC</th>
                        <th>Qué Reproceso Falta</th>
                        <th>Nro Entrega & Fecha</th>
                        <th>Estado Revisión & Fecha</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        filtered.forEach(v => {
            // Badge class
            let badgeClass = 'badge-info';
            if (v.status === 'RECHAZADO') badgeClass = 'badge-danger';
            if (v.status === 'ACEPTADO') badgeClass = 'badge-success';
            if (v.status === 'EN REPROCESO') badgeClass = 'badge-alert';
            if (v.status === 'PENDIENTE DE REVISIÓN') badgeClass = 'badge-warning';
            
            // Row color class
            let rowClass = 'row-sinestado';
            if (v.status === 'RECHAZADO') rowClass = 'row-rechazado';
            else if (v.status === 'ACEPTADO') rowClass = 'row-aceptado';
            else if (v.status === 'EN REPROCESO') rowClass = 'row-reproceso';
            else if (v.status === 'PENDIENTE DE REVISIÓN') rowClass = 'row-pendiente';
            
            // Extract dictionary mapped data
            const ex = v.extraInfo || {};
            const entregaStr = ex.entregaNum ? `${ex.entregaNum} (${ex.entregaDate})` : '-';
            const revisionStr = ex.status ? `${ex.status} (${ex.revDate})` : '-';
            
            // Rejection Delta Span logic
            let deltaHTML = `<td>-</td>`;
            if (v.status === 'RECHAZADO') {
                const addDangerClass = v.isCriticalRejection ? 'badge badge-danger' : 'badge badge-info';
                deltaHTML = `<td><span class="${addDangerClass}"><i class="fa-regular fa-clock"></i> ${v.rejectionDeltaStr}</span></td>`;
            }
            
            tableHTML += `
                <tr class="${rowClass}" data-vin="${v.vin}">
                    ${deltaHTML}
                    <td class="vin-cell">${v.vin}</td>
                    <td class="model-cell" title="${v.modelo}">${v.modelo}</td>
                    <td>${v.color || '-'}</td>
                    <td><b>${v.ubicacionEsum || '-'}</b></td>
                    <td><span class="badge ${badgeClass}">${v.status}</span></td>
                    <td class="dest-cell">${v.destino || '-'}</td>
                    <td>${v.dealer || '-'}</td>
                    <td>${v.estadoCC || '-'}</td>
                    <td class="text-danger">${v.reprocesoFalta || '-'}</td>
                    <td>${entregaStr}</td>
                    <td>${revisionStr}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
            <div class="table-footer">
                <i class="fa-solid fa-table-list"></i>
                <span>${filtered.length} vehículo${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}</span>
            </div>
        `;
        
        els.vehiclesContainer.innerHTML = tableHTML;
        
        // Add click events to table rows
        document.querySelectorAll('.vehicles-table tbody tr').forEach(row => {
            row.addEventListener('click', () => {
                const vin = row.getAttribute('data-vin');
                const vehicle = allVehicles.find(v => v.vin === vin);
                if (vehicle) openModal(vehicle);
            });
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
    if (v.status === 'RECHAZADO') badge.classList.add('badge-danger');
    else if (v.status === 'ACEPTADO') badge.classList.add('badge-success');
    else if (v.status === 'EN REPROCESO') badge.classList.add('badge-alert');
    else if (v.status === 'PENDIENTE DE REVISIÓN') badge.classList.add('badge-warning');
    else badge.classList.add('badge-info');

    // Info Group 1
    document.getElementById('mDestino').textContent = getVal('Destino');
    document.getElementById('mDealer').textContent = getVal('DEALER');
    document.getElementById('mUbi').textContent = getVal('UBICACIÓN ESUM');
    document.getElementById('mTaller').textContent = getVal('TALLER');

    // Info Group 2 (Datos del diccionario extra cruzado extraInfo)
    const ex = v.extraInfo || {};
    document.getElementById('mPreparado').textContent = getVal('REALIZADO');
    document.getElementById('mEstadoCC').textContent = getVal('Estado CC');
    
    // Mostramos la data del drive secundario
    document.getElementById('mEntregaASSA').textContent = ex.entregaNum ? `${ex.entregaNum} (${ex.entregaDate})` : '-';
    document.getElementById('mRevASSA').textContent = ex.status ? `${ex.status} (${ex.revDate})` : '-';
    
    // Ocultaremos los campos redundantes (ya que ahora unificamos por diccionario y destino)
    document.getElementById('mEntregaREVO').parentElement.style.display = 'none';
    document.getElementById('mRevREVO').parentElement.style.display = 'none';

    // Para evitar confusión, cambiamos los labels dinámicamente:
    document.getElementById('mEntregaASSA').previousElementSibling.innerHTML = '<i class="fa-solid fa-truck"></i> Nro Entrega & Fecha';
    document.getElementById('mRevASSA').previousElementSibling.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Estado Revisión & Fecha';

    // Info Group 3: Reprocess
    const reproGroup = document.getElementById('reprocessGroup');
    const reproFalta = getVal('QUE REPROCESO FALTA');
    const rpPintura = getVal('REPROCESO PINTURA');
    const rpRepuesto = getVal('REPROCESO REPUESTOS');

    if (reproFalta !== '-' || rpPintura !== '-' || rpRepuesto !== '-') {
        reproGroup.classList.remove('hidden');
        document.getElementById('mQueFalta').textContent = reproFalta;
        document.getElementById('mPintura').textContent = rpPintura;
        document.getElementById('mRepuestos').textContent = rpRepuesto;
        document.getElementById('mObsFinal').textContent = ex.obs ? ex.obs : '-';
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
