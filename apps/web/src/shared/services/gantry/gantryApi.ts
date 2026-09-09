import {
  AttachmentDetail,
  AttachmentSummary,
  Discussion,
  DiscussionCreate,
  DiscussionUpdate,
  Message,
  MessageRole,
  Project,
  ProjectCreate,
  ProjectFile,
  ProjectUpdate,
  Template,
  TemplateCreate,
  TemplateUpdate,
} from '@/shared/types';
import { gantryClient } from './client';
import { discussionLocal } from './discussionLocal';
import { templateLocal } from './templateLocal';
import { toQodexProject, projectNotesLocal } from './projectMapper';

/** Qodex-shaped API surface backed by Gantry /v1 + local stores (M2). */
export class GantryApiService {
  async healthCheck() {
    const health = await gantryClient.health();
    return { status: health.status, providers: { gantry: true } };
  }

  async getDiscussions(): Promise<Discussion[]> {
    return discussionLocal.list();
  }

  async getDiscussion(id: string): Promise<Discussion> {
    const row = discussionLocal.get(id);
    if (!row) throw new Error('discussion not found');
    return row;
  }

  async createDiscussion(data?: DiscussionCreate): Promise<Discussion> {
    return discussionLocal.create(data);
  }

  async updateDiscussion(id: string, data: DiscussionUpdate): Promise<Discussion> {
    return discussionLocal.update(id, data);
  }

  async deleteDiscussion(id: string): Promise<void> {
    discussionLocal.delete(id);
  }

  async deleteAllDiscussions(): Promise<{ status: string; count: number }> {
    const count = discussionLocal.deleteAll();
    return { status: 'ok', count };
  }

  async activateDiscussion(id: string): Promise<Discussion> {
    return discussionLocal.update(id, { is_active: true });
  }

  async addMessage(discussionId: string, content: string, role: MessageRole): Promise<Message> {
    return discussionLocal.addMessage(discussionId, content, role);
  }

  async getProjects(): Promise<Project[]> {
    const rows = await gantryClient.listProjects();
    return rows.map(toQodexProject);
  }

  async getProject(id: string): Promise<Project> {
    try {
      const row = await gantryClient.getProject(id);
      return toQodexProject(row);
    } catch {
      const projects = await this.getProjects();
      const row = projects.find(p => p.id === id);
      if (!row) throw new Error('project not found');
      return row;
    }
  }

  async createProject(data: ProjectCreate): Promise<Project> {
    const row = await gantryClient.createProject(data.name, data.github_url ?? undefined);
    if (data.instructions) {
      projectNotesLocal.set(row.id, data.instructions);
    }
    return toQodexProject(row);
  }

  async updateProject(id: string, data: ProjectUpdate): Promise<Project> {
    const row = await gantryClient.updateProject(id, {
      name: data.name,
      github_url: data.github_url ?? undefined,
    });
    if (data.instructions !== undefined) {
      projectNotesLocal.set(id, data.instructions);
    }
    return toQodexProject(row);
  }

  async deleteProject(_id: string): Promise<void> {
    throw new Error('Project delete is not available via public /v1/projects yet');
  }

  async getProjectDiscussions(id: string): Promise<Discussion[]> {
    return discussionLocal.list().filter(d => d.project_id === id);
  }

  async getProjectFiles(_projectId: string): Promise<ProjectFile[]> {
    return [];
  }

  async uploadProjectFile(_projectId: string, _file: File): Promise<ProjectFile> {
    throw new Error('Project files are not available on Gantry yet');
  }

  async deleteProjectFile(_projectId: string, _fileId: string): Promise<void> {
    /* no-op */
  }

  async getTemplates(): Promise<Template[]> {
    return templateLocal.list();
  }

  async createTemplate(data: TemplateCreate): Promise<Template> {
    return templateLocal.create(data);
  }

  async updateTemplate(id: string, data: TemplateUpdate): Promise<Template> {
    return templateLocal.update(id, data);
  }

  async deleteTemplate(id: string): Promise<void> {
    templateLocal.delete(id);
  }

  getStreamUrl(): string {
    return '';
  }

  async uploadAttachment(_discussionId: string, _file: File): Promise<AttachmentSummary> {
    throw new Error('Attachments are not available on Gantry yet');
  }

  async getAttachments(_discussionId: string): Promise<AttachmentSummary[]> {
    return [];
  }

  async getAttachmentDetail(_discussionId: string, _attachmentId: string): Promise<AttachmentDetail> {
    throw new Error('Attachments are not available on Gantry yet');
  }

  async deleteAttachment(_discussionId: string, _attachmentId: string): Promise<void> {
    /* no-op */
  }
}

export const gantryApiService = new GantryApiService();
