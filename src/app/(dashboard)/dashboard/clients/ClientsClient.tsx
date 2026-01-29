'use client';

import { useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiUsers, FiSettings } from 'react-icons/fi';
import { toast } from 'sonner';
import {
  createClientAction,
  updateClientAction,
  deleteClientAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
} from '@/server/timeTracking/actions';
import type { Client, ClientProject } from '@/types/timeTracking';
import { CLIENT_COLORS } from '@/types/timeTracking';
import InvoiceSettingsModal from './InvoiceSettingsModal';
import styles from './clients.module.css';

interface ClientsClientProps {
  initialClients: Client[];
  initialProjects: ClientProject[];
}

export default function ClientsClient({ initialClients, initialProjects }: ClientsClientProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [projects, setProjects] = useState<ClientProject[]>(initialProjects);
  
  // Modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isInvoiceSettingsOpen, setIsInvoiceSettingsOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [projectClientId, setProjectClientId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<ClientProject | null>(null);

  // Open client modal for create/edit
  const openClientModal = (client?: Client) => {
    setEditingClient(client || null);
    setIsClientModalOpen(true);
  };

  // Open project modal for create/edit
  const openProjectModal = (clientId: string, project?: ClientProject) => {
    setProjectClientId(clientId);
    setEditingProject(project || null);
    setIsProjectModalOpen(true);
  };

  // Handle client delete
  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete "${client.name}"? This will also delete all associated projects.`)) {
      return;
    }
    
    try {
      const result = await deleteClientAction(client.id);
      if (result.success) {
        setClients(clients.filter(c => c.id !== client.id));
        setProjects(projects.filter(p => p.clientId !== client.id));
        toast.success('Client deleted');
      } else {
        toast.error(result.error || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Failed to delete client:', error);
      toast.error('Failed to delete client');
    }
  };

  // Handle project delete
  const handleDeleteProject = async (project: ClientProject) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) {
      return;
    }
    
    try {
      const result = await deleteProjectAction(project.id);
      if (result.success) {
        setProjects(projects.filter(p => p.id !== project.id));
        toast.success('Project deleted');
      } else {
        toast.error(result.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
    }
  };

  // Get projects for a client
  const getClientProjects = (clientId: string) => {
    return projects.filter(p => p.clientId === clientId);
  };

  // Handle client save callback
  const handleClientSaved = (client: Client, isNew: boolean) => {
    if (isNew) {
      setClients([...clients, client]);
    } else {
      setClients(clients.map(c => c.id === client.id ? client : c));
    }
    setIsClientModalOpen(false);
    setEditingClient(null);
  };

  // Handle project save callback
  const handleProjectSaved = (project: ClientProject, isNew: boolean) => {
    if (isNew) {
      setProjects([...projects, project]);
    } else {
      setProjects(projects.map(p => p.id === project.id ? project : p));
    }
    setIsProjectModalOpen(false);
    setProjectClientId(null);
    setEditingProject(null);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Clients</h1>
        <div className={styles.headerActions}>
          <button className={styles.settingsBtn} onClick={() => setIsInvoiceSettingsOpen(true)}>
            <FiSettings size={18} />
            Invoice Settings
          </button>
          <button className={styles.addBtn} onClick={() => openClientModal()}>
            <FiPlus size={18} />
            Add Client
          </button>
        </div>
      </div>

      {/* Clients Grid */}
      {clients.length > 0 ? (
        <div className={styles.clientsGrid}>
          {clients.map((client) => {
            const clientProjects = getClientProjects(client.id);
            
            return (
              <div key={client.id} className={styles.clientCard}>
                {/* Client Header */}
                <div className={styles.clientHeader}>
                  <div 
                    className={styles.clientColor}
                    style={{ backgroundColor: client.color }}
                  >
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.clientInfo}>
                    <div className={styles.clientName}>{client.name}</div>
                    {client.email && (
                      <div className={styles.clientEmail}>{client.email}</div>
                    )}
                  </div>
                  <div className={styles.clientActions}>
                    <button 
                      className={styles.actionBtn}
                      onClick={() => openClientModal(client)}
                      title="Edit client"
                    >
                      <FiEdit2 size={14} />
                    </button>
                    <button 
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => handleDeleteClient(client)}
                      title="Delete client"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Client Details */}
                <div className={styles.clientDetails}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Hourly Rate</span>
                    <span className={`${styles.detailValue} ${styles.detailValueHighlight}`}>
                      ${client.hourlyRate.toFixed(2)}/hr
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status</span>
                    <span className={`${styles.statusBadge} ${client.isActive ? styles.statusActive : styles.statusInactive}`}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Projects</span>
                    <span className={styles.detailValue}>{clientProjects.length}</span>
                  </div>
                </div>

                {/* Projects Section */}
                <div className={styles.projectsSection}>
                  <div className={styles.projectsHeader}>
                    <span className={styles.projectsTitle}>Projects</span>
                    <button 
                      className={styles.addProjectBtn}
                      onClick={() => openProjectModal(client.id)}
                    >
                      <FiPlus size={12} />
                      Add
                    </button>
                  </div>
                  
                  {clientProjects.length > 0 ? (
                    <div className={styles.projectsList}>
                      {clientProjects.map((project) => (
                        <div key={project.id} className={styles.projectItem}>
                          <span className={styles.projectName}>{project.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {project.hourlyRate && (
                              <span className={styles.projectRate}>
                                ${project.hourlyRate}/hr
                              </span>
                            )}
                            <button 
                              className={styles.actionBtn}
                              onClick={() => openProjectModal(client.id, project)}
                              style={{ width: '24px', height: '24px' }}
                              title="Edit project"
                            >
                              <FiEdit2 size={12} />
                            </button>
                            <button 
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => handleDeleteProject(project)}
                              style={{ width: '24px', height: '24px' }}
                              title="Delete project"
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.noProjects}>No projects yet</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FiUsers size={32} />
          </div>
          <h3 className={styles.emptyTitle}>No clients yet</h3>
          <p className={styles.emptyDescription}>
            Add your first client to start tracking time and generating invoices.
          </p>
          <button className={styles.addBtn} onClick={() => openClientModal()}>
            <FiPlus size={18} />
            Add Your First Client
          </button>
        </div>
      )}

      {/* Invoice Settings Modal */}
      {isInvoiceSettingsOpen && (
        <InvoiceSettingsModal
          onClose={() => setIsInvoiceSettingsOpen(false)}
        />
      )}

      {/* Client Modal */}
      {isClientModalOpen && (
        <ClientModal
          client={editingClient}
          onClose={() => {
            setIsClientModalOpen(false);
            setEditingClient(null);
          }}
          onSave={handleClientSaved}
        />
      )}

      {/* Project Modal */}
      {isProjectModalOpen && projectClientId && (
        <ProjectModal
          clientId={projectClientId}
          project={editingProject}
          onClose={() => {
            setIsProjectModalOpen(false);
            setProjectClientId(null);
            setEditingProject(null);
          }}
          onSave={handleProjectSaved}
        />
      )}
    </div>
  );
}

// Client Modal Component
interface ClientModalProps {
  client: Client | null;
  onClose: () => void;
  onSave: (client: Client, isNew: boolean) => void;
}

function ClientModal({ client, onClose, onSave }: ClientModalProps) {
  const [name, setName] = useState(client?.name || '');
  const [email, setEmail] = useState(client?.email || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [address, setAddress] = useState(client?.address || '');
  const [hourlyRate, setHourlyRate] = useState(client?.hourlyRate?.toString() || '0');
  const [color, setColor] = useState(client?.color || CLIENT_COLORS[0]);
  const [notes, setNotes] = useState(client?.notes || '');
  const [isActive, setIsActive] = useState(client?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Client name is required');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set('name', name);
      formData.set('email', email);
      formData.set('phone', phone);
      formData.set('address', address);
      formData.set('hourlyRate', hourlyRate);
      formData.set('color', color);
      formData.set('notes', notes);
      formData.set('isActive', isActive.toString());

      const result = client
        ? await updateClientAction(client.id, formData)
        : await createClientAction(formData);

      if (result.success && result.data) {
        toast.success(client ? 'Client updated' : 'Client created');
        onSave(result.data as Client, !client);
      } else {
        toast.error(result.error || 'Failed to save client');
      }
    } catch (error) {
      console.error('Failed to save client:', error);
      toast.error('Failed to save client');
    }
    setIsSaving(false);
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {client ? 'Edit Client' : 'Add Client'}
          </h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Name *</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Phone</label>
              <input
                type="tel"
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Address</label>
            <textarea
              className={styles.textarea}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State 12345"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Hourly Rate ($)</label>
            <input
              type="number"
              className={styles.input}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Color</label>
            <div className={styles.colorPicker}>
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorOption} ${color === c ? styles.colorOptionSelected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Notes</label>
            <textarea
              className={styles.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this client..."
            />
          </div>

          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--blue-electric)' }}
              />
              <span className={styles.label} style={{ margin: 0 }}>Active Client</span>
            </label>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : client ? 'Update Client' : 'Add Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Project Modal Component
interface ProjectModalProps {
  clientId: string;
  project?: ClientProject | null;
  onClose: () => void;
  onSave: (project: ClientProject, isNew: boolean) => void;
}

function ProjectModal({ clientId, project, onClose, onSave }: ProjectModalProps) {
  const isEditing = !!project;
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [hourlyRate, setHourlyRate] = useState(project?.hourlyRate?.toString() || '');
  const [color, setColor] = useState(project?.color || CLIENT_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.set('clientId', clientId);
      formData.set('name', name);
      formData.set('description', description);
      formData.set('color', color);
      if (hourlyRate) {
        formData.set('hourlyRate', hourlyRate);
      }

      let result;
      if (isEditing && project) {
        result = await updateProjectAction(project.id, formData);
      } else {
        result = await createProjectAction(formData);
      }

      if (result.success && result.data) {
        toast.success(isEditing ? 'Project updated' : 'Project created');
        onSave(result.data as ClientProject, !isEditing);
      } else {
        toast.error(result.error || `Failed to ${isEditing ? 'update' : 'create'} project`);
      }
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} project:`, error);
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} project`);
    }
    setIsSaving(false);
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose} />
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditing ? 'Edit Project' : 'Add Project'}</h2>
          <button className={styles.modalCloseBtn} onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Name *</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project description..."
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Hourly Rate Override ($)</label>
            <input
              type="number"
              className={styles.input}
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              min="0"
              step="0.01"
              placeholder="Leave empty to use client rate"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Color</label>
            <div className={styles.colorPicker}>
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorOption} ${color === c ? styles.colorOptionSelected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Project')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
