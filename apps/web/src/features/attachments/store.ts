import { create } from 'zustand';
import { AttachmentSummary, AttachmentDetail } from '@/shared/types';
import { api } from '@/shared/services/api';

interface AttachmentState {
  attachments: AttachmentSummary[];
  previewAttachment: AttachmentDetail | null;
  isUploading: boolean;
  uploadProgress: number;
  isLoadingPreview: boolean;
  error: string | null;
}

interface AttachmentActions {
  fetchAttachments: (discussionId: string) => Promise<void>;
  uploadAttachment: (discussionId: string, file: File) => Promise<AttachmentSummary>;
  deleteAttachment: (discussionId: string, attachmentId: string) => Promise<void>;
  loadPreview: (discussionId: string, attachmentId: string) => Promise<void>;
  closePreview: () => void;
  reset: () => void;
  clearError: () => void;
}

type AttachmentStore = AttachmentState & AttachmentActions;

const initialState: AttachmentState = {
  attachments: [],
  previewAttachment: null,
  isUploading: false,
  uploadProgress: 0,
  isLoadingPreview: false,
  error: null,
};

export const useAttachmentStore = create<AttachmentStore>((set) => ({
  ...initialState,

  fetchAttachments: async (discussionId: string) => {
    try {
      const attachments = await api.getAttachments(discussionId);
      set({ attachments });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  uploadAttachment: async (discussionId: string, file: File) => {
    set({ isUploading: true, uploadProgress: 0, error: null });
    try {
      set({ uploadProgress: 30 });
      const attachment = await api.uploadAttachment(discussionId, file);
      set({ uploadProgress: 100 });
      set((state) => ({
        attachments: [...state.attachments, attachment],
        isUploading: false,
        uploadProgress: 0,
      }));
      return attachment;
    } catch (error) {
      set({ error: (error as Error).message, isUploading: false, uploadProgress: 0 });
      throw error;
    }
  },

  deleteAttachment: async (discussionId: string, attachmentId: string) => {
    try {
      await api.deleteAttachment(discussionId, attachmentId);
      set((state) => ({
        attachments: state.attachments.filter((a) => a.id !== attachmentId),
        previewAttachment:
          state.previewAttachment?.id === attachmentId ? null : state.previewAttachment,
      }));
    } catch (error) {
      set({ error: (error as Error).message });
      throw error;
    }
  },

  loadPreview: async (discussionId: string, attachmentId: string) => {
    set({ isLoadingPreview: true, error: null });
    try {
      const detail = await api.getAttachmentDetail(discussionId, attachmentId);
      set({ previewAttachment: detail, isLoadingPreview: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoadingPreview: false });
    }
  },

  closePreview: () => set({ previewAttachment: null }),
  reset: () => set(initialState),
  clearError: () => set({ error: null }),
}));
