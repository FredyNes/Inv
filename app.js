// Módulo de utilidades
const Utils = {
    sanitizeInput: (input) => {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },

    formatDate: (dateString) => {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Fecha inválida';
            
            const pad = num => num.toString().padStart(2, '0');
            return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
        } catch (error) {
            console.error('Error al formatear fecha:', error);
            return 'Fecha inválida';
        }
    },

    getCurrentDate: () => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    },

    getStatusText: (status) => {
        const statusMap = {
            'pending': 'Pendiente',
            'completed': 'Completo'
        };
        return statusMap[status] || status;
    },

    showToast: (message, type = 'success') => {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        setTimeout(() => toast.classList.add('visible'), 100);
        
        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    },

    debounce: (func, delay) => {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
};

// Módulo de almacenamiento
const Storage = {
    STORAGE_KEY: 'repairs_nes_data',

    save: (data) => {
        try {
            const dataToSave = JSON.stringify({
                repairs: data,
                lastUpdate: new Date().toISOString()
            });
            
            localStorage.setItem(Storage.STORAGE_KEY, dataToSave);
            sessionStorage.setItem(Storage.STORAGE_KEY, dataToSave); // Backup
            document.getElementById('last-update').textContent = Utils.formatDate(new Date());
        } catch (error) {
            console.error('Error al guardar:', error);
            if (error.name === 'QuotaExceededError') {
                Utils.showToast('Advertencia: Espacio de almacenamiento excedido', 'error');
            }
        }
    },

    load: () => {
        try {
            const saved = localStorage.getItem(Storage.STORAGE_KEY) || sessionStorage.getItem(Storage.STORAGE_KEY);
            if (saved) {
                const parsedData = JSON.parse(saved);
                document.getElementById('last-update').textContent = Utils.formatDate(parsedData.lastUpdate);
                return parsedData.repairs || [];
            }
            return [];
        } catch (error) {
            console.error('Error al cargar:', error);
            return [];
        }
    }
};

// Módulo de manejo de CSV
const CSVHandler = {
    exportToCSV: (repairs) => {
        try {
            let csv = 'Modelo,Serial,Cliente,Caso,Falla,Parte Dañada,Observación,Fecha Registro,Estado\n';
            
            repairs.forEach(repair => {
                csv += `"${repair.model || ''}","${repair.serial || ''}","${repair.client || ''}",` +
                      `"${repair.case || ''}","${repair.issue || ''}","${repair.damagedPart || ''}",` +
                      `"${repair.observation || ''}","${Utils.formatDate(repair.date)}","${Utils.getStatusText(repair.status || 'pending')}"\n`;
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
            
            Utils.showToast('Exportación a CSV completada');
        } catch (error) {
            console.error('Error al exportar:', error);
            Utils.showToast('Error al exportar CSV', 'error');
        }
    },

    parseCSV: (csvString) => {
        const lines = csvString.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío o no tiene el formato correcto');
        }

        const parseLine = (line) => {
            const result = [];
            let inQuotes = false;
            let currentField = '';
            
            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(currentField.trim());
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            result.push(currentField.trim());
            return result;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase());
        const requiredHeaders = ['modelo', 'serial', 'cliente'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
            throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}`);
        }
        
        const results = [];
        const opcionesPartes = ['Board', 'Pantalla', 'Teclado', 'Touchpad', 'Parlantes', 
                              'Ventilador', 'Camara', 'Ram', 'Disco', 'Puerto Usb', 
                              'Hdmi', 'DisplayPort'];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const currentLine = parseLine(lines[i]);
            const entry = {};
            
            for (let j = 0; j < headers.length; j++) {
                if (j < currentLine.length) {
                    entry[headers[j]] = currentLine[j].trim();
                } else {
                    entry[headers[j]] = '';
                }
            }
            
            let parteDanada = entry['parte dañada'] || entry.parte || '';
            if (parteDanada && !opcionesPartes.includes(parteDanada)) {
                parteDanada = '';
            }
            
            results.push({
                id: `IMP-${Date.now()}-${i}`,
                model: Utils.sanitizeInput(entry.modelo || ''),
                serial: Utils.sanitizeInput(entry.serial || ''),
                client: Utils.sanitizeInput(entry.cliente || ''),
                case: Utils.sanitizeInput(entry.caso || 'Importado'),
                issue: Utils.sanitizeInput(entry.falla || entry.issue || 'Sin descripción'),
                damagedPart: parteDanada || 'No especificada',
                observation: Utils.sanitizeInput(entry.observacion || entry.notes || ''),
                date: entry.fecha ? new Date(entry.fecha).toISOString().split('T')[0] : Utils.getCurrentDate(),
                status: entry.estado === 'completo' ? 'completed' : 'pending'
            });
        }
        
        return results;
    },

    validateImportedData: (data, existingRepairs) => {
        const errors = [];
        
        data.forEach((item, index) => {
            if (!item.model || !item.serial || !item.client) {
                errors.push(`Fila ${index + 1}: Faltan datos requeridos (modelo, serial o cliente)`);
            }
            
            if (item.serial && existingRepairs.some(r => r.serial === item.serial)) {
                errors.push(`Fila ${index + 1}: El serial ${item.serial} ya existe`);
            }
        });
        
        if (errors.length > 0) {
            throw new Error(`Errores de validación:\n${errors.join('\n')}`);
        }
    }
};

// Módulo de interfaz de usuario
const UI = {
    currentPage: 1,
    itemsPerPage: 10,

    init: () => {
        document.getElementById('current-year').textContent = new Date().getFullYear();
    },

    renderRepairs: (items = [], currentRepairs = []) => {
        const repairsTable = document.getElementById('inventory-items');
        repairsTable.innerHTML = '';
        
        if (items.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="10" class="no-data">No hay reparaciones registradas</td>
            `;
            repairsTable.appendChild(row);
            return;
        }
        
        const start = (UI.currentPage - 1) * UI.itemsPerPage;
        const paginatedItems = items.slice(start, start + UI.itemsPerPage);
        
        paginatedItems.forEach(repair => {
            const status = repair.status || 'pending';
            const statusClass = `status-${status}`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${repair.model || 'N/A'}</td>
                <td>${repair.serial || 'N/A'}</td>
                <td>${repair.client || 'N/A'}</td>
                <td>${repair.case || 'N/A'}</td>
                <td class="issue-cell" title="${repair.issue || ''}">
                    ${repair.issue ? (repair.issue.substring(0, 30) + (repair.issue.length > 30 ? '...' : '') : 'N/A'}
                </td>
                <td>${repair.damagedPart || 'N/A'}</td>
                <td class="observation-cell" title="${repair.observation || ''}">
                    ${repair.observation ? (repair.observation.substring(0, 30) + (repair.observation.length > 30 ? '...' : '') : 'N/A'}
                </td>
                <td>${Utils.formatDate(repair.date)}</td>
                <td class="${statusClass}">${Utils.getStatusText(status)}</td>
                <td class="actions">
                    <button class="edit" data-id="${repair.id}"><i class="fas fa-edit"></i></button>
                    <button class="delete" data-id="${repair.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            
            repairsTable.appendChild(row);
        });
        
        // Actualizar controles de paginación
        document.getElementById('page-info').textContent = 
            `Página ${UI.currentPage} de ${Math.ceil(items.length / UI.itemsPerPage)}`;
        document.getElementById('prev-page').disabled = UI.currentPage === 1;
        document.getElementById('next-page').disabled = 
            UI.currentPage * UI.itemsPerPage >= items.length;
    },

    setupEventListeners: (repairs, saveCallback, editCallback, deleteCallback) => {
        // Paginación
        document.getElementById('prev-page').addEventListener('click', () => {
            if (UI.currentPage > 1) {
                UI.currentPage--;
                UI.renderRepairs(repairs);
            }
        });

        document.getElementById('next-page').addEventListener('click', () => {
            if (UI.currentPage * UI.itemsPerPage < repairs.length) {
                UI.currentPage++;
                UI.renderRepairs(repairs);
            }
        });

        // Búsqueda con debounce
        document.getElementById('search').addEventListener('input', Utils.debounce((e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filtered = repairs.filter(repair => 
                (repair.model && repair.model.toLowerCase().includes(searchTerm)) || 
                (repair.serial && repair.serial.toLowerCase().includes(searchTerm)) ||
                (repair.client && repair.client.toLowerCase().includes(searchTerm)) ||
                (repair.case && repair.case.toLowerCase().includes(searchTerm)) ||
                (repair.issue && repair.issue.toLowerCase().includes(searchTerm)) ||
                (repair.observation && repair.observation.toLowerCase().includes(searchTerm))
            );
            UI.currentPage = 1;
            UI.renderRepairs(filtered);
        }, 300));

        // Filtros
        document.getElementById('filter-all').addEventListener('click', () => {
            UI.currentPage = 1;
            UI.renderRepairs(repairs);
        });

        document.getElementById('filter-pending').addEventListener('click', () => {
            const filtered = repairs.filter(repair => (repair.status || 'pending') === 'pending');
            UI.currentPage = 1;
            UI.renderRepairs(filtered);
        });

        document.getElementById('filter-completed').addEventListener('click', () => {
            const filtered = repairs.filter(repair => (repair.status || 'pending') === 'completed');
            UI.currentPage = 1;
            UI.renderRepairs(filtered);
        });

        // Botones de acción
        document.getElementById('add-item').addEventListener('click', () => {
            document.getElementById('modal-title').textContent = 'Nueva Reparación';
            document.getElementById('item-form').reset();
            document.getElementById('item-id').value = '';
            document.getElementById('item-date').value = Utils.getCurrentDate();
            document.getElementById('item-status').value = 'pending';
            document.getElementById('item-modal').style.display = 'block';
        });

        document.getElementById('print-list').addEventListener('click', () => {
            window.print();
        });

        document.getElementById('export-csv').addEventListener('click', () => {
            if (confirm('¿Exportar todos los registros a CSV?')) {
                CSVHandler.exportToCSV(repairs);
            }
        });

        // Importación CSV
        document.getElementById('import-csv').addEventListener('click', () => {
            document.getElementById('csv-file').click();
        });

        document.getElementById('csv-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const progressDiv = document.getElementById('import-progress');
            progressDiv.innerHTML = `
                <p>Procesando archivo...</p>
                <div class="progress-bar">
                    <div class="progress-bar-fill" style="width: 0%"></div>
                </div>
                <div id="import-result"></div>
            `;
            progressDiv.style.display = 'block';
            
            const progressBar = progressDiv.querySelector('.progress-bar-fill');
            const resultDiv = progressDiv.querySelector('#import-result');
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    progressBar.style.width = '30%';
                    const csvData = event.target.result;
                    const parsedData = CSVHandler.parseCSV(csvData);
                    
                    progressBar.style.width = '60%';
                    CSVHandler.validateImportedData(parsedData, repairs);
                    
                    progressBar.style.width = '80%';
                    const uniqueNewData = parsedData.filter(newItem => 
                        !repairs.some(existingItem => existingItem.serial === newItem.serial)
                    );
                    
                    repairs.push(...uniqueNewData);
                    saveCallback(repairs);
                    
                    progressBar.style.width = '100%';
                    resultDiv.className = 'success';
                    resultDiv.innerHTML = `
                        <p><i class="fas fa-check-circle"></i> Importación exitosa!</p>
                        <p>Se importaron ${uniqueNewData.length} registros.</p>
                    `;
                    
                    UI.currentPage = 1;
                    UI.renderRepairs(repairs);
                    
                    setTimeout(() => {
                        progressDiv.style.display = 'none';
                        document.getElementById('csv-file').value = '';
                    }, 3000);
                    
                    Utils.showToast(`Importados ${uniqueNewData.length} registros`);
                } catch (error) {
                    progressBar.style.width = '100%';
                    resultDiv.className = 'error';
                    resultDiv.innerHTML = `
                        <p><i class="fas fa-exclamation-triangle"></i> Error en importación</p>
                        <p>${error.message}</p>
                    `;
                    console.error('Error al importar:', error);
                    Utils.showToast('Error al importar CSV', 'error');
                }
            };
            
            reader.onerror = () => {
                progressBar.style.width = '100%';
                resultDiv.className = 'error';
                resultDiv.innerHTML = '<p>Error al leer el archivo</p>';
                Utils.showToast('Error al leer el archivo', 'error');
            };
            
            reader.readAsText(file);
        });

        // Modal
        const modal = document.getElementById('item-modal');
        document.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Delegación de eventos para botones de acción dinámicos
        document.getElementById('inventory-items').addEventListener('click', (e) => {
            if (e.target.closest('.edit')) {
                const id = e.target.closest('.edit').dataset.id;
                editCallback(id);
            } else if (e.target.closest('.delete')) {
                const id = e.target.closest('.delete').dataset.id;
                deleteCallback(id);
            }
        });
    }
};

// Módulo principal
const App = {
    repairs: [],

    init: () => {
        UI.init();
        App.repairs = Storage.load();
        
        if (App.repairs.length === 0) {
            Utils.showToast('Sistema listo. Comience agregando una nueva reparación.', 'info');
        } else {
            Utils.showToast(`Cargadas ${App.repairs.length} reparaciones`);
        }
        
        UI.renderRepairs(App.repairs);
        UI.setupEventListeners(
            App.repairs,
            App.saveRepairs,
            App.editRepair,
            App.deleteRepair
        );
        
        App.setupForm();
    },

    saveRepairs: () => {
        Storage.save(App.repairs);
        Utils.showToast('Reparaciones guardadas');
    },

    editRepair: (id) => {
        const repair = App.repairs.find(repair => repair.id === id);
        if (!repair) {
            console.error('Reparación no encontrada:', id);
            return;
        }
        
        document.getElementById('modal-title').textContent = 'Editar Reparación';
        document.getElementById('item-id').value = repair.id;
        document.getElementById('item-model').value = repair.model || '';
        document.getElementById('item-serial').value = repair.serial || '';
        document.getElementById('item-client').value = repair.client || '';
        document.getElementById('item-case').value = repair.case || '';
        document.getElementById('item-issue').value = repair.issue || '';
        document.getElementById('item-damaged').value = repair.damagedPart || '';
        document.getElementById('item-notes').value = repair.observation || '';
        document.getElementById('item-date').value = repair.date ? repair.date.split('T')[0] : Utils.getCurrentDate();
        document.getElementById('item-status').value = repair.status || 'pending';
        
        document.getElementById('item-modal').style.display = 'block';
    },

    deleteRepair: (id) => {
        if (confirm('¿Estás seguro de eliminar este registro de reparación?')) {
            App.repairs = App.repairs.filter(repair => repair.id !== id);
            App.saveRepairs();
            UI.currentPage = 1;
            UI.renderRepairs(App.repairs);
            Utils.showToast('Reparación eliminada');
        }
    },

    setupForm: () => {
        document.getElementById('item-form').addEventListener('submit', function(e) {
            e.preventDefault();
            
            try {
                const repairData = {
                    id: document.getElementById('item-id').value || `REP-${Date.now().toString().slice(-4)}`,
                    model: Utils.sanitizeInput(document.getElementById('item-model').value.trim()),
                    serial: Utils.sanitizeInput(document.getElementById('item-serial').value.trim()),
                    client: Utils.sanitizeInput(document.getElementById('item-client').value.trim()),
                    case: Utils.sanitizeInput(document.getElementById('item-case').value.trim()),
                    issue: Utils.sanitizeInput(document.getElementById('item-issue').value.trim()),
                    damagedPart: document.getElementById('item-damaged').value || 'No especificada',
                    observation: Utils.sanitizeInput(document.getElementById('item-notes').value.trim()),
                    date: document.getElementById('item-date').value || Utils.getCurrentDate(),
                    status: document.getElementById('item-status').value
                };
                
                if (!repairData.model || !repairData.serial || !repairData.client || !repairData.case || !repairData.issue) {
                    Utils.showToast('Complete los campos obligatorios', 'error');
                    return;
                }
                
                const existingId = document.getElementById('item-id').value;
                
                if (existingId) {
                    // Actualizar
                    const index = App.repairs.findIndex(repair => repair.id === existingId);
                    if (index !== -1) {
                        App.repairs[index] = repairData;
                        Utils.showToast('Reparación actualizada');
                    }
                } else {
                    // Añadir nueva
                    App.repairs.push(repairData);
                    Utils.showToast('Nueva reparación agregada');
                }
                
                App.saveRepairs();
                UI.currentPage = 1;
                UI.renderRepairs(App.repairs);
                document.getElementById('item-modal').style.display = 'none';
            } catch (error) {
                console.error('Error al guardar:', error);
                Utils.showToast('Error al guardar los datos', 'error');
            }
        });
    }
};

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', App.init);

// Guardar antes de cerrar la página
window.addEventListener('beforeunload', () => {
    if (App.repairs.length > 0) {
        App.saveRepairs();
    }
});
