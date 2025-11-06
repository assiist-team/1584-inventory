import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseClient, createMockProject, createNotFoundError } from './test-utils'

// Mock Supabase before importing services
const mockSupabase = createMockSupabaseClient()
vi.mock('../supabase', () => ({
  supabase: mockSupabase
}))

// Mock databaseService
vi.mock('../databaseService', () => ({
  ensureAuthenticatedForDatabase: vi.fn().mockResolvedValue(undefined),
  convertTimestamps: vi.fn((data) => data)
}))

// Import after mocks are set up
import { projectService } from '../inventoryService'
import * as supabaseModule from '../supabase'

describe('projectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProjects', () => {
    it('should return projects for account', async () => {
      const mockProjects = [
        createMockProject({ id: 'project-1', name: 'Project 1' }),
        createMockProject({ id: 'project-2', name: 'Project 2' })
      ]
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockProjects, error: null })
      } as any)

      const projects = await projectService.getProjects('test-account-id')
      expect(projects).toHaveLength(2)
      expect(projects[0].name).toBe('Project 1')
    })

    it('should return empty array when no projects', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      const projects = await projectService.getProjects('test-account-id')
      expect(projects).toEqual([])
    })
  })

  describe('getProject', () => {
    it('should return project when found', async () => {
      const mockProject = createMockProject()
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null })
      } as any)

      const project = await projectService.getProject('test-account-id', 'test-project-id')
      expect(project).toBeTruthy()
      expect(project?.id).toBe('test-project-id')
    })

    it('should return null when project not found', async () => {
      const notFoundError = createNotFoundError()
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: notFoundError })
      } as any)

      const project = await projectService.getProject('test-account-id', 'non-existent-id')
      expect(project).toBeNull()
    })
  })

  describe('createProject', () => {
    it('should create a new project', async () => {
      const mockProject = createMockProject()
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: mockProject.id }, error: null })
      } as any)

      const projectData = {
        name: 'New Project',
        description: 'Description',
        clientName: 'Client',
        createdBy: 'user-id',
        accountId: 'test-account-id'
      }

      const projectId = await projectService.createProject('test-account-id', projectData as any)
      expect(projectId).toBe(mockProject.id)
    })

    it('should throw error on failure', async () => {
      const error = { code: '500', message: 'Server error', details: null, hint: null }
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error })
      } as any)

      const projectData = {
        name: 'New Project',
        createdBy: 'user-id',
        accountId: 'test-account-id'
      }

      await expect(
        projectService.createProject('test-account-id', projectData as any)
      ).rejects.toEqual(error)
    })
  })

  describe('updateProject', () => {
    it('should update project', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        projectService.updateProject('test-account-id', 'test-project-id', { name: 'Updated Name' })
      ).resolves.not.toThrow()
    })
  })

  describe('deleteProject', () => {
    it('should delete project', async () => {
      const mockQueryBuilder = createMockSupabaseClient().from('projects')
      
      vi.mocked(supabaseModule.supabase.from).mockReturnValue({
        ...mockQueryBuilder,
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      await expect(
        projectService.deleteProject('test-account-id', 'test-project-id')
      ).resolves.not.toThrow()
    })
  })
})

