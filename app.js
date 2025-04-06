// Base de datos para reparaciones
let repairs = [];
const STORAGE_KEY = 'repairs_nes_data';

// Elementos del DOM
const repairsTable = document.getElementById('inventory-items');
const searchInput = document.getElementById('search');
const addButton = document.getElementById('add-item');
const printButton = document.getElementById('print-list');
const exportButton = document.getElementById('export-csv');
const importButton = document.getElementById('import-csv');
const fileInput = document.getElementById('csv-file');
const modal = document.getElementById('item-modal');
const closeButton = document.querySelector('.close');
const repairForm = document.getElementById('item-form');
const currentYearSpan = document.getElementById('current-year');
const lastUpdateSpan = document.getElementById('last-update');
const filterAllBtn = document.getElementById('filter-all');
const filterPendingBtn = document.getElementById('filter-pending');
const filterCompletedBtn = document.getElementById('filter-completed');

// Funciones de utilidad
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            throw new Error('Fecha inválida');
        }
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        return date.toLocaleString('es-ES', options);
    } catch (error) {
        console.error('Error al formatear fecha:', error);
        return 'Fecha inválida';
    }
}

function getCurrentDateTime() {
    const now = new Date();
    return now.toISOString().slice(0, 16);
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'completed': 'Completo'
    };
    return statusMap[status] || status;
}

// Renderizar la tabla de reparaciones
function renderRepairs(items = repairs) {
    try {
        repairsTable.innerHTML = '';
        
        if (items.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="10" class="no-data">No hay reparaciones registradas</td>
            `;
            repairsTable.appendChild(row);
            return;
        }
        
        items.forEach(repair => {
            const status = repair.status || 'pending';
            const statusClass = `status-${status}`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${repair.model || 'N/A'}</td>
                <td>${repair.serial || 'N/A'}</td>
                <td>${repair.client || 'N/A'}</td>
                <td>${repair.case || 'N/A'}</td>
                <td class="issue-cell" title="${repair.issue || ''}">
                    ${repair.issue ? (repair.issue.substring(0, 30) + (repair.issue.length > 30 ? '...' : '')) : 'N/A'}
                </td>
                <td>${repair.damagedPart || 'N/A'}</td>
                <td class="observation-cell" title="${repair.observation || ''}">
                    ${repair.observation ? (repair.observation.substring(0, 30) + (repair.observation.length > 30 ? '...' : '')) : 'N/A'}
                </td>
                <td>${formatDate(repair.date)}</td>
                <td class="${statusClass}">${getStatusText(status)}</td>
                <td class="actions">
                    <button class="edit" data-id="${repair.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete" data-id="${repair.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            
            repairsTable.appendChild(row);
        });
        
        // Agregar eventos a los botones de acción
        document.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', () => editRepair(btn.dataset.id));
        });
        
        document.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteRepair(btn.dataset.id));
        });
    } catch (error) {
        console.error('Error al renderizar reparaciones:', error);
    }
}

// Filtrar reparaciones por estado
function filterByStatus(status) {
    try {
        if (status === 'all') {
            renderRepairs();
            return;
        }
        
        const filtered = repairs.filter(repair => {
            return (repair.status || 'pending') === status;
        });
        renderRepairs(filtered);
    } catch (error) {
        console.error('Error al filtrar por estado:', error);
    }
}

// Guardar reparaciones en localStorage
function saveRepairs() {
    try {
        const dataToSave = JSON.stringify({
            repairs: repairs,
            lastUpdate: new Date().toISOString()
        });
        
        localStorage.setItem(STORAGE_KEY, dataToSave);
        sessionStorage.setItem(STORAGE_KEY, dataToSave); // Backup
        lastUpdateSpan.textContent = formatDate(new Date());
        console.log('Datos guardados correctamente');
    } catch (error) {
        console.error('Error al guardar reparaciones:', error);
        if (error.name === 'QuotaExceededError') {
            alert('Advertencia: Se ha excedido el espacio de almacenamiento. Algunos datos podrían no guardarse.');
        }
    }
}

// Cargar reparaciones desde localStorage
function loadRepairs() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsedData = JSON.parse(saved);
            repairs = parsedData.repairs || [];
            if (parsedData.lastUpdate) {
                lastUpdateSpan.textContent = formatDate(parsedData.lastUpdate);
            }
            console.log('Datos cargados correctamente');
        } else {
            // Datos de ejemplo si no hay nada guardado
            repairs = [{
                id: "REP-" + Date.now().toString().slice(-4),
                model: "Ejemplo Modelo",
                serial: "ABC123XYZ",
                client: "Cliente Ejemplo",
                case: "Caso de prueba",
                issue: "Falla de ejemplo para demostración",
                damagedPart: "Board",
                observation: "",
                date: getCurrentDateTime(),
                status: "pending"
            }];
            saveRepairs();
        }
    } catch (error) {
        console.error('Error al cargar reparaciones:', error);
        repairs = [];
    }
}

// Editar reparación
function editRepair(id) {
    try {
        const repair = repairs.find(repair => repair.id === id);
        if (!repair) {
            console.error('Reparación no encontrada:', id);
            return;
        }
        
        document.getElementById('modal-title').textContent = 'Agregar';
        document.getElementById('item-id').value = repair.id;
        document.getElementById('item-model').value = repair.model || '';
        document.getElementById('item-serial').value = repair.serial || '';
        document.getElementById('item-client').value = repair.client || '';
        document.getElementById('item-case').value = repair.case || '';
        document.getElementById('item-issue').value = repair.issue || '';
        document.getElementById('item-damaged').value = repair.damagedPart || '';
        document.getElementById('item-notes').value = repair.observation || '';
        document.getElementById('item-date').value = repair.date ? repair.date.slice(0, 16) : getCurrentDateTime();
        document.getElementById('item-status').value = repair.status || 'pending';
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error al editar reparación:', error);
    }
}

// Eliminar reparación
function deleteRepair(id) {
    try {
        if (confirm('¿Estás seguro de eliminar este registro de reparación?')) {
            repairs = repairs.filter(repair => repair.id !== id);
            saveRepairs();
            renderRepairs();
        }
    } catch (error) {
        console.error('Error al eliminar reparación:', error);
    }
}

// Exportar a CSV
function exportToCSV() {
    try {
        let csv = 'Modelo,Serial,Cliente,Caso,Falla,Parte Dañada,Observación,Fecha Registro,Estado\n';
        
        repairs.forEach(repair => {
            csv += `"${repair.model || ''}","${repair.serial || ''}","${repair.client || ''}",` +
                  `"${repair.case || ''}","${repair.issue || ''}","${repair.damagedPart || ''}",` +
                  `"${repair.observation || ''}","${formatDate(repair.date)}","${getStatusText(repair.status || 'pending')}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reparaciones_nes_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error al exportar a CSV:', error);
        alert('Error al generar el archivo CSV');
    }
}

// Función para manejar la importación de CSV
function setupCSVImport() {
    const progressDiv = document.createElement('div');
    progressDiv.id = 'import-progress';
    progressDiv.innerHTML = `
        <p>Procesando archivo...</p>
        <div class="progress-bar">
            <div class="progress-bar-fill" style="width: 0%"></div>
        </div>
        <div id="import-result"></div>
    `;
    importButton.insertAdjacentElement('afterend', progressDiv);
    
    importButton.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        progressDiv.style.display = 'block';
        const progressBar = progressDiv.querySelector('.progress-bar-fill');
        const resultDiv = document.getElementById('import-result');
        resultDiv.style.display = 'none';
        
        reader.onload = (event) => {
            try {
                progressBar.style.width = '30%';
                const csvData = event.target.result;
                const parsedData = parseCSV(csvData);
                
                progressBar.style.width = '60%';
                validateImportedData(parsedData);
                
                progressBar.style.width = '80%';
                mergeImportedData(parsedData);
                
                progressBar.style.width = '100%';
                resultDiv.className = 'success';
                resultDiv.innerHTML = `
                    <p><i class="fas fa-check-circle"></i> Importación exitosa!</p>
                    <p>Se importaron ${parsedData.length} registros.</p>
                `;
                resultDiv.style.display = 'block';
                
                // Actualizar la vista
                renderRepairs();
                saveRepairs();
                
                // Resetear el input de archivo
                fileInput.value = '';
                
                // Ocultar progreso después de 3 segundos
                setTimeout(() => {
                    progressDiv.style.display = 'none';
                }, 3000);
                
            } catch (error) {
                progressBar.style.width = '100%';
                resultDiv.className = 'error';
                resultDiv.innerHTML = `
                    <p><i class="fas fa-exclamation-triangle"></i> Error en importación</p>
                    <p>${error.message}</p>
                `;
                resultDiv.style.display = 'block';
                console.error('Error al importar CSV:', error);
            }
        };
        
        reader.onerror = () => {
            progressBar.style.width = '100%';
            resultDiv.className = 'error';
            resultDiv.innerHTML = '<p>Error al leer el archivo</p>';
            resultDiv.style.display = 'block';
        };
        
        reader.readAsText(file);
    });
}

// Función para analizar el CSV
function parseCSV(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('El archivo CSV está vacío o no tiene el formato correcto');
    }
    
    // Obtener cabeceras
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Validar cabeceras mínimas requeridas
    const requiredHeaders = ['modelo', 'serial', 'cliente'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
        throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`);
    }
    
    // Procesar líneas de datos
    const results = [];
    const opcionesPartes = ['Board', 'Pantalla', 'Teclado', 'Touchpad', 'Parlantes', 
                          'Ventilador', 'Camara', 'Ram', 'Disco', 'Puerto Usb', 
                          'Hdmi', 'DisplayPort'];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const currentLine = lines[i].split(',');
        const entry = {};
        
        for (let j = 0; j < headers.length; j++) {
            if (j < currentLine.length) {
                entry[headers[j]] = currentLine[j].trim();
            } else {
                entry[headers[j]] = '';
            }
        }
        
        // Validar y mapear la parte dañada
        let parteDanada = entry['parte dañada'] || entry.parte || '';
        if (parteDanada && !opcionesPartes.includes(parteDanada)) {
            parteDanada = ''; // Si no es una opción válida, dejamos vacío
        }
        
        results.push({
            id: `IMP-${Date.now()}-${i}`,
            model: entry.modelo || '',
            serial: entry.serial || '',
            client: entry.cliente || '',
            case: entry.caso || 'Importado',
            issue: entry.falla || entry.issue || 'Sin descripción',
            damagedPart: parteDanada || 'No especificada',
            observation: entry.observacion || entry.notes || '',
            date: entry.fecha || getCurrentDateTime(),
            status: entry.estado === 'completo' ? 'completed' : 'pending'
        });
    }
    
    return results;
}

// Función para validar datos importados
function validateImportedData(data) {
    const errors = [];
    
    data.forEach((item, index) => {
        if (!item.model || !item.serial || !item.client) {
            errors.push(`Fila ${index + 1}: Faltan datos requeridos (modelo, serial o cliente)`);
        }
        
        if (item.serial && repairs.some(r => r.serial === item.serial)) {
            errors.push(`Fila ${index + 1}: El serial ${item.serial} ya existe`);
        }
    });
    
    if (errors.length > 0) {
        throw new Error(`Errores de validación:\n${errors.join('\n')}`);
    }
}

// Función para fusionar datos importados
function mergeImportedData(newData) {
    // Filtrar duplicados por serial
    const uniqueNewData = newData.filter(newItem => 
        !repairs.some(existingItem => existingItem.serial === newItem.serial)
    );
    
    repairs = [...repairs, ...uniqueNewData];
}

// Manejar el formulario
repairForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    try {
        const repairData = {
            id: document.getElementById('item-id').value || `REP-${Date.now().toString().slice(-4)}`,
            model: document.getElementById('item-model').value.trim(),
            serial: document.getElementById('item-serial').value.trim(),
            client: document.getElementById('item-client').value.trim(),
            case: document.getElementById('item-case').value.trim(),
            issue: document.getElementById('item-issue').value.trim(),
            damagedPart: document.getElementById('item-damaged').value || 'No especificada',
            observation: document.getElementById('item-notes').value.trim(),
            date: document.getElementById('item-date').value || getCurrentDateTime(),
            status: document.getElementById('item-status').value
        };
        
        // Validación básica
        if (!repairData.model || !repairData.serial || !repairData.client) {
            alert('Por favor complete los campos obligatorios: Modelo, Serial y Cliente');
            return;
        }
        
        const existingId = document.getElementById('item-id').value;
        
        if (existingId) {
            // Actualizar reparación existente
            const index = repairs.findIndex(repair => repair.id === existingId);
            if (index !== -1) {
                repairs[index] = repairData;
            }
        } else {
            // Añadir nueva reparación
            repairs.push(repairData);
        }
        
        saveRepairs();
        renderRepairs();
        modal.style.display = 'none';
    } catch (error) {
        console.error('Error al procesar el formulario:', error);
        alert('Ocurrió un error al guardar los datos');
    }
});

// Event Listeners
addButton.addEventListener('click', () => {
    document.getElementById('modal-title').textContent = 'Agregar';
    repairForm.reset();
    document.getElementById('item-id').value = '';
    document.getElementById('item-date').value = getCurrentDateTime();
    document.getElementById('item-status').value = 'pending';
    modal.style.display = 'block';
});

closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

searchInput.addEventListener('input', (e) => {
    try {
        const searchTerm = e.target.value.toLowerCase();
        const filtered = repairs.filter(repair => 
            (repair.model && repair.model.toLowerCase().includes(searchTerm)) || 
            (repair.serial && repair.serial.toLowerCase().includes(searchTerm)) ||
            (repair.client && repair.client.toLowerCase().includes(searchTerm)) ||
            (repair.case && repair.case.toLowerCase().includes(searchTerm)) ||
            (repair.issue && repair.issue.toLowerCase().includes(searchTerm)) ||
            (repair.observation && repair.observation.toLowerCase().includes(searchTerm))
        );
        renderRepairs(filtered);
    } catch (error) {
        console.error('Error al buscar:', error);
    }
});

printButton.addEventListener('click', () => {
    window.print();
});

exportButton.addEventListener('click', exportToCSV);

filterAllBtn.addEventListener('click', () => filterByStatus('all'));
filterPendingBtn.addEventListener('click', () => filterByStatus('pending'));
filterCompletedBtn.addEventListener('click', () => filterByStatus('completed'));

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    currentYearSpan.textContent = new Date().getFullYear();
    loadRepairs();
    renderRepairs();
    setupCSVImport();
    
    // Verificar soporte para localStorage
    if (typeof(Storage) === 'undefined') {
        alert('Advertencia: Tu navegador no soporta localStorage. Los datos solo se guardarán durante esta sesión.');
    }
    
    // Guardar antes de cerrar la página
    window.addEventListener('beforeunload', function() {
        saveRepairs();
    });

    async function loadDataFromGitHub() {
    if (!githubConfig.owner || !githubConfig.repo || !githubConfig.token) {
        showMessage(syncStatus, 'Configuración de GitHub incompleta. Usando datos locales.', 'error');
        loadFromLocalStorage();
        return;
    }
    
    showMessage(syncStatus, 'Cargando datos desde GitHub...', 'info');
    
    try {
        const response = await fetch(
            `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/data.json`,
            {
                headers: {
                    'Authorization': `token ${githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                // El archivo no existe, crearemos uno nuevo al guardar
                showMessage(syncStatus, 'No se encontró archivo de datos. Se creará uno nuevo al guardar.', 'info');
                loadFromLocalStorage();
                return;
            }
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        const content = JSON.parse(atob(data.content));
        repairs = content.reparaciones || [];
        renderRepairs();
        showMessage(syncStatus, 'Datos cargados correctamente desde GitHub.', 'success');
        saveToLocalStorage(); // Guardar localmente como respaldo
        
    } catch (error) {
        console.error('Error al cargar datos de GitHub:', error);
        showMessage(syncStatus, `Error al cargar datos: ${error.message}. Usando datos locales.`, 'error');
        loadFromLocalStorage();
    }
}
async function saveDataToGitHub() {
    if (!githubConfig.owner || !githubConfig.repo || !githubConfig.token) {
        showMessage(syncStatus, 'Configuración de GitHub incompleta. Guardando localmente.', 'error');
        saveToLocalStorage();
        return;
    }
    
    showMessage(syncStatus, 'Sincronizando con GitHub...', 'info');
    
    try {
        // Primero obtén el SHA del archivo actual si existe
        let sha = '';
        try {
            const getResponse = await fetch(
                `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/data.json`,
                {
                    headers: {
                        'Authorization': `token ${githubConfig.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
            }
        } catch (e) {
            console.log('Archivo no existe aún, se creará uno nuevo');
        }
        
        // Prepara los datos para guardar
        const content = {
            reparaciones: repairs
        };
        
        const message = `Actualización de datos ${new Date().toISOString()}`;
        const contentEncoded = btoa(JSON.stringify(content, null, 2));
        
        const response = await fetch(
            `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/data.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    content: contentEncoded,
                    sha: sha || undefined
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al guardar en GitHub');
        }
        
        console.log('Datos guardados en GitHub correctamente');
        showMessage(syncStatus, 'Datos sincronizados con GitHub correctamente.', 'success');
        saveToLocalStorage(); // También guarda localmente como respaldo
        
    } catch (error) {
        console.error('Error al guardar en GitHub:', error);
        showMessage(syncStatus, `Error al sincronizar: ${error.message}. Guardando localmente.`, 'error');
        saveToLocalStorage(); // Si falla GitHub, guarda solo localmente
    }
}
function showMessage(element, message, type) {
    element.textContent = message;
    element.className = 'status-message';
    if (type === 'success') {
        element.classList.add('status-success');
    } else if (type === 'error') {
        element.classList.add('status-error');
    } else {
        element.style.display = 'block';
        element.style.backgroundColor = '#e2e3e5';
        element.style.color = '#383d41';
    }
}
    
});
