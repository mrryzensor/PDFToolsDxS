import React, { useState, useMemo } from 'react';
import {
  Users, UserCheck, Clock, CheckCircle2, AlertCircle, Search, 
  Filter, Plus, Download, FileText, Calendar, Edit3, Trash2, 
  Eye, MessageSquare, ChevronRight, BarChart3, ArrowUpDown, 
  Sparkles, CheckSquare, Tag, Phone, Mail, Award, Layers, X
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';
import { 
  getRecordsCases, saveRecordCase, deleteRecordCase 
} from '../../utils/storage';
import { 
  generateConstanciaPDF, generateReporteSeguimientoPDF 
} from '../../utils/recordPdfExporter';

const RECORD_TYPES = [
  { id: 'alumno', label: 'Alumno / Estudiante', icon: Users, badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { id: 'cliente', label: 'Cliente Comercial', icon: UserCheck, badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'solicitud', label: 'Solicitud / Trámite', icon: Clock, badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { id: 'interesado', label: 'Interesado / Prospecto', icon: Sparkles, badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
];

const STATUS_OPTIONS = [
  { id: 'Nuevo', label: 'Nuevo / Registrado', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  { id: 'En Proceso', label: 'En Proceso / Cursando', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  { id: 'En Revisión', label: 'En Revisión / Pendiente', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { id: 'Completado', label: 'Completado / Aprobado', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'Archivado', label: 'Archivado / Cerrado', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
];

export const RecordsManagerView = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState(() => getRecordsCases());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt'); // 'updatedAt' | 'fullName' | 'progress' | 'dueDate'

  // Modals & Active Record
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);

  // Form State for Create / Edit
  const [form, setForm] = useState({
    id: '',
    code: '',
    type: 'alumno',
    fullName: '',
    docType: 'DNI',
    docNumber: '',
    email: '',
    phone: '',
    category: '',
    status: 'Nuevo',
    progress: 0,
    dueDate: '',
    description: '',
  });

  // Note form for active record detail
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteAuthor, setNewNoteAuthor] = useState('Coordinador');

  const refreshList = () => {
    setRecords(getRecordsCases());
  };

  // Open Form for New
  const handleOpenNew = () => {
    const year = new Date().getFullYear();
    const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    setForm({
      id: '',
      code: `EXP-${year}-${randomCode}`,
      type: filterType !== 'all' ? filterType : 'alumno',
      fullName: '',
      docType: 'DNI',
      docNumber: '',
      email: '',
      phone: '',
      category: '',
      status: 'Nuevo',
      progress: 0,
      dueDate: '',
      description: '',
    });
    setIsFormModalOpen(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (rec) => {
    setForm({
      id: rec.id,
      code: rec.code || '',
      type: rec.type || 'alumno',
      fullName: rec.fullName || '',
      docType: rec.docType || 'DNI',
      docNumber: rec.docNumber || '',
      email: rec.email || '',
      phone: rec.phone || '',
      category: rec.category || '',
      status: rec.status || 'Nuevo',
      progress: rec.progress || 0,
      dueDate: rec.dueDate || '',
      description: rec.description || '',
    });
    setIsFormModalOpen(true);
  };

  // Save Record
  const handleSaveForm = (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      showToast('Ingresa el nombre completo de la persona o solicitud', 'warning');
      return;
    }

    const saved = saveRecordCase({
      ...form,
      fullName: form.fullName.trim(),
      progress: Number(form.progress) || 0,
    });

    refreshList();
    setIsFormModalOpen(false);
    showToast(form.id ? 'Registro actualizado con éxito' : 'Nuevo registro creado exitosamente', 'success');

    if (activeRecord && activeRecord.id === saved.id) {
      setActiveRecord(saved);
    }
  };

  // Delete Record
  const handleDelete = (id) => {
    if (window.confirm('¿Deseas eliminar este registro de la base de datos?')) {
      deleteRecordCase(id);
      refreshList();
      showToast('Registro eliminado', 'info');
      if (activeRecord && activeRecord.id === id) {
        setIsDetailModalOpen(false);
        setActiveRecord(null);
      }
    }
  };

  // Add note / log to active record
  const handleAddNote = () => {
    if (!newNoteText.trim() || !activeRecord) return;
    const noteObj = {
      id: `n_${Date.now()}`,
      text: newNoteText.trim(),
      author: newNoteAuthor.trim() || 'Coordinador',
      date: new Date().toISOString(),
    };
    const updatedNotes = [noteObj, ...(activeRecord.notes || [])];
    const updated = saveRecordCase({
      ...activeRecord,
      notes: updatedNotes,
    });
    setActiveRecord(updated);
    refreshList();
    setNewNoteText('');
    showToast('Anotación de seguimiento registrada en la bitácora', 'success');
  };

  // Quick Status change
  const handleUpdateStatus = (record, newStatus) => {
    const historyItem = {
      id: `h_${Date.now()}`,
      action: `Cambio de estado a: ${newStatus}`,
      date: new Date().toISOString(),
      status: newStatus,
    };
    const updated = saveRecordCase({
      ...record,
      status: newStatus,
      history: [historyItem, ...(record.history || [])],
    });
    refreshList();
    if (activeRecord && activeRecord.id === record.id) {
      setActiveRecord(updated);
    }
    showToast(`Estado actualizado a: ${newStatus}`, 'info');
  };

  // Quick Progress change
  const handleUpdateProgress = (record, newProgress) => {
    const val = Math.max(0, Math.min(100, Number(newProgress)));
    const updated = saveRecordCase({
      ...record,
      progress: val,
    });
    refreshList();
    if (activeRecord && activeRecord.id === record.id) {
      setActiveRecord(updated);
    }
  };

  // Filtered & Sorted Records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (filterType !== 'all' && r.type !== filterType) return false;
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (r.fullName || '').toLowerCase().includes(q);
          const matchCode = (r.code || '').toLowerCase().includes(q);
          const matchDoc = (r.docNumber || '').toLowerCase().includes(q);
          const matchCat = (r.category || '').toLowerCase().includes(q);
          const matchEmail = (r.email || '').toLowerCase().includes(q);
          const matchPhone = (r.phone || '').toLowerCase().includes(q);
          return matchName || matchCode || matchDoc || matchCat || matchEmail || matchPhone;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'fullName') return (a.fullName || '').localeCompare(b.fullName || '');
        if (sortBy === 'progress') return (b.progress || 0) - (a.progress || 0);
        if (sortBy === 'dueDate') return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });
  }, [records, filterType, filterStatus, searchQuery, sortBy]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = records.length;
    const completed = records.filter((r) => r.status === 'Completado').length;
    const inProgress = records.filter((r) => r.status === 'En Proceso').length;
    const pending = records.filter((r) => r.status === 'Nuevo' || r.status === 'En Revisión').length;
    const avgProgress = total > 0 ? Math.round(records.reduce((acc, cur) => acc + (cur.progress || 0), 0) / total) : 0;
    return { total, completed, inProgress, pending, avgProgress };
  }, [records]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface text-on-surface">
      {/* Top Banner & Control Bar */}
      <div className="border-b border-outline-variant/30 dark:border-slate-800 bg-surface-container-low dark:bg-slate-900/90 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
                Gestión Integral: Personas, Clientes y Solicitudes
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                  {records.length} expedientes
                </span>
              </h1>
              <p className="text-xs text-on-surface-variant">
                Registra personas, revisa avances, bitácoras de notas y emite constancias oficiales o reportes en PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => generateReporteSeguimientoPDF(filteredRecords, filterType !== 'all' ? filterType.toUpperCase() : 'TODOS')}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-outline-variant/40 hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-all disabled:opacity-40"
            title="Exportar listado actual a Reporte PDF"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>Reporte PDF</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Registro</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3.5 bg-surface-container-lowest dark:bg-slate-950 border-b border-outline-variant/20 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/20">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-outline">Total Registros</div>
            <div className="text-base font-bold text-on-surface">{stats.total}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/20">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-outline">En Proceso</div>
            <div className="text-base font-bold text-sky-600 dark:text-sky-400">{stats.inProgress}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/20">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-outline">Completados</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/20">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-outline">Avance Promedio</div>
            <div className="text-base font-bold text-primary">{stats.avgProgress}%</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 bg-surface-container-low dark:bg-slate-900/60 border-b border-outline-variant/20 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código, DNI, teléfono o categoría..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-slate-950 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-slate-950 text-xs font-semibold text-on-surface focus:outline-none"
          >
            <option value="all">Todos los Tipos</option>
            <option value="alumno">Alumnos</option>
            <option value="cliente">Clientes</option>
            <option value="solicitud">Solicitudes</option>
            <option value="interesado">Interesados</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-slate-950 text-xs font-semibold text-on-surface focus:outline-none"
          >
            <option value="all">Todos los Estados</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st.id} value={st.id}>{st.label}</option>
            ))}
          </select>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest dark:bg-slate-950 text-xs font-semibold text-on-surface focus:outline-none"
          >
            <option value="updatedAt">Más recientes</option>
            <option value="fullName">Nombre (A-Z)</option>
            <option value="progress">Mayor avance</option>
            <option value="dueDate">Fecha límite</option>
          </select>
        </div>
      </div>

      {/* Main Grid of Records */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border-2 border-dashed border-outline-variant/40 dark:border-slate-800 text-outline space-y-3">
            <Users className="w-12 h-12 mx-auto text-outline/60" />
            <h3 className="text-base font-bold text-on-surface">No se encontraron expedientes</h3>
            <p className="text-xs max-w-md mx-auto text-on-surface-variant">
              {searchQuery || filterType !== 'all' || filterStatus !== 'all'
                ? 'Prueba modificando tus términos de búsqueda o quitando los filtros aplicados.'
                : 'Empieza registrando a tu primer alumno, cliente o solicitud de caso para realizar el seguimiento.'}
            </p>
            <button
              type="button"
              onClick={handleOpenNew}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Ahora</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecords.map((rec) => {
              const typeCfg = RECORD_TYPES.find((t) => t.id === rec.type) || RECORD_TYPES[0];
              const statusCfg = STATUS_OPTIONS.find((s) => s.id === rec.status) || STATUS_OPTIONS[0];

              return (
                <div
                  key={rec.id}
                  className="rounded-2xl bg-surface-container-lowest dark:bg-slate-900 border border-outline-variant/30 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                >
                  {/* Card Header: Type Badge & Action Menu */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeCfg.badgeBg}`}>
                        <typeCfg.icon className="w-3 h-3" />
                        {typeCfg.label}
                      </span>

                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusCfg.color}`}>
                        {rec.status}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-outline">
                          {rec.code || 'EXP-SIN-COD'}
                        </span>
                        <h4 className="font-bold text-sm text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
                          {rec.fullName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRecord(rec);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container-high transition-colors"
                          title="Ver expediente y bitácora"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(rec)}
                          className="p-1 rounded-lg text-outline hover:text-amber-500 hover:bg-surface-container-high transition-colors"
                          title="Editar expediente"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec.id)}
                          className="p-1 rounded-lg text-outline hover:text-rose-500 hover:bg-surface-container-high transition-colors"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata items */}
                    <div className="space-y-1 mt-2 text-xs text-on-surface-variant">
                      {rec.category && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Tag className="w-3 h-3 text-outline" />
                          <span className="font-semibold">{rec.category}</span>
                        </div>
                      )}

                      {(rec.phone || rec.email) && (
                        <div className="flex items-center gap-3 text-[11px] text-outline">
                          {rec.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3" /> {rec.phone}
                            </span>
                          )}
                          {rec.email && (
                            <span className="flex items-center gap-1 truncate max-w-[130px]">
                              <Mail className="w-3 h-3" /> {rec.email}
                            </span>
                          )}
                        </div>
                      )}

                      {rec.dueDate && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          <Calendar className="w-3 h-3" />
                          <span>Hito / Vencimiento: {rec.dueDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress & Bottom Actions */}
                  <div className="pt-3 border-t border-outline-variant/20 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-semibold text-outline">Nivel de Avance</span>
                      <span className="text-xs font-bold text-primary font-mono">{rec.progress || 0}%</span>
                    </div>

                    {/* Interactive Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden cursor-pointer">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${rec.progress || 0}%` }}
                      />
                    </div>

                    {/* Action Bar: Quick Status dropdown + PDF certificate */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <select
                        value={rec.status}
                        onChange={(e) => handleUpdateStatus(rec, e.target.value)}
                        className="text-[11px] font-semibold py-1 px-2 rounded-lg border border-outline-variant/30 bg-surface-container-low focus:outline-none cursor-pointer"
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st.id} value={st.id}>{st.label}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => generateConstanciaPDF(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                        title="Emitir constancia oficial en PDF"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Constancia PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Create / Edit Record */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={form.id ? 'Editar Expediente de Caso' : 'Nuevo Registro de Persona / Caso'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Tipo de Registro:</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-semibold"
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Código de Expediente:</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ej. EXP-2026-001"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Nombre Completo / Razón Social *:</label>
            <input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Ej. María Elena Quispe Flores"
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Documento:</label>
              <select
                value={form.docType}
                onChange={(e) => setForm({ ...form, docType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none font-semibold"
              >
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="CE">C. Extranjería</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Código">Código Estudiantil</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-on-surface mb-1">N° Documento:</label>
              <input
                type="text"
                value={form.docNumber}
                onChange={(e) => setForm({ ...form, docNumber: e.target.value })}
                placeholder="Número identificatorio"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Teléfono / WhatsApp:</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+51 987 654 321"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Correo Electrónico:</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Categoría / Curso:</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ej. IA Pedagógica / Diplomado"
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Estado Inicial:</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none font-semibold"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface mb-1">Porcentaje de Avance:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none font-mono"
                />
                <span className="text-xs font-bold text-outline">%</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Fecha Límite / Próximo Hito:</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">Descripción / Notas Iniciales del Caso:</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detalles sobre los requerimientos, notas de ingreso, requisitos pendientes..."
              className="w-full px-3 py-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Guardar Expediente
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Record Detail & Tracking Notes (Bitácora) */}
      {activeRecord && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Expediente: ${activeRecord.fullName} (${activeRecord.code})`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Header overview card */}
            <div className="p-4 rounded-2xl bg-surface-container-low dark:bg-slate-900 border border-outline-variant/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-outline">
                    {activeRecord.type?.toUpperCase()} • {activeRecord.category || 'General'}
                  </span>
                  <h3 className="text-base font-bold text-on-surface">{activeRecord.fullName}</h3>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-outline">Estado</span>
                  <div className="font-bold text-xs text-primary">{activeRecord.status}</div>
                </div>
              </div>

              {/* Progress Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-outline font-semibold">Avance Actual:</span>
                  <span className="font-bold text-primary">{activeRecord.progress || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={activeRecord.progress || 0}
                  onChange={(e) => handleUpdateProgress(activeRecord, e.target.value)}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Quick info row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-outline-variant/20 text-xs">
                <div>
                  <span className="text-[10px] text-outline block">Identificación:</span>
                  <span className="font-mono font-semibold">{activeRecord.docType}: {activeRecord.docNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">WhatsApp:</span>
                  <span className="font-mono font-semibold">{activeRecord.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Correo:</span>
                  <span className="truncate block font-semibold">{activeRecord.email || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-outline block">Hito / Vence:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{activeRecord.dueDate || 'Sin fecha'}</span>
                </div>
              </div>
            </div>

            {/* Emit Certificate in PDF */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 block">Emisión Documental Oficial</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                  Genera la constancia oficial de avance y expediente en PDF de esta persona.
                </span>
              </div>
              <button
                type="button"
                onClick={() => generateConstanciaPDF(activeRecord)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Constancia PDF</span>
              </button>
            </div>

            {/* Notes & Tracking Timeline (Bitácora) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                <span>Bitácora de Avances y Notas de Seguimiento</span>
              </h4>

              {/* Add Note Input */}
              <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-2">
                <textarea
                  rows={2}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Escribe una observación, acuerdo o avance sobre este caso..."
                  className="w-full p-2 rounded-lg border border-outline-variant/20 bg-surface-container-low text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={newNoteAuthor}
                    onChange={(e) => setNewNoteAuthor(e.target.value)}
                    placeholder="Tu nombre o cargo"
                    className="px-2 py-1 rounded border border-outline-variant/20 bg-surface-container-low text-[11px] text-on-surface w-40"
                  />
                  <button
                    type="button"
                    onClick={handleAddNote}
                    disabled={!newNoteText.trim()}
                    className="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold transition-all disabled:opacity-40"
                  >
                    Agregar Nota
                  </button>
                </div>
              </div>

              {/* Notes list */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(!activeRecord.notes || activeRecord.notes.length === 0) ? (
                  <p className="text-xs text-outline italic text-center py-4">
                    No hay notas registradas en la bitácora aún.
                  </p>
                ) : (
                  activeRecord.notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-xl bg-surface-container-lowest dark:bg-slate-950 border border-outline-variant/20 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between text-[10px] text-outline">
                        <span className="font-bold text-on-surface">{note.author}</span>
                        <span>{new Date(note.date).toLocaleString('es-ES')}</span>
                      </div>
                      <p className="text-on-surface-variant leading-relaxed">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
