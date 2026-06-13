const ScaffoldService = require('../../services/scaffolds.service');
const Scaffold = require('../../models/scaffold');
const ScaffoldSection = require('../../models/scaffoldSection');
const ScaffoldHistory = require('../../models/scaffoldHistory');
const Project = require('../../models/project');
const db = require('../../db');
const { uploadFile, resolveImageUrl } = require('../../lib/googleCloud');

jest.mock('../../models/scaffold');
jest.mock('../../models/scaffoldSection');
jest.mock('../../models/scaffoldHistory');
jest.mock('../../models/project');
jest.mock('../../db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));
jest.mock('../../lib/googleCloud', () => ({
  uploadFile: jest.fn(),
  deleteFileByUrl: jest.fn(),
  resolveImageUrl: jest.fn(),
}));
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ScaffoldService - autorización y máquina de estados', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveImageUrl.mockImplementation((url) => Promise.resolve(url));
  });

  // =====================================================
  // validateUserPermissions
  // =====================================================

  describe('validateUserPermissions', () => {
    it('admin no lanza con cualquier andamio y proyecto', () => {
      const user = { id: 1, role: 'admin' };
      const scaffold = { created_by: 99 };
      const project = { assigned_supervisor_id: 99 };
      expect(() => ScaffoldService.validateUserPermissions(user, scaffold, project)).not.toThrow();
    });

    it('supervisor creador no lanza', () => {
      const user = { id: 2, role: 'supervisor' };
      const scaffold = { created_by: 2 };
      const project = { assigned_supervisor_id: 99 };
      expect(() => ScaffoldService.validateUserPermissions(user, scaffold, project)).not.toThrow();
    });

    it('supervisor asignado al proyecto no lanza', () => {
      const user = { id: 3, role: 'supervisor' };
      const scaffold = { created_by: 99 };
      const project = { assigned_supervisor_id: 3 };
      expect(() => ScaffoldService.validateUserPermissions(user, scaffold, project)).not.toThrow();
    });

    it('supervisor ni creador ni asignado lanza 403', () => {
      const user = { id: 4, role: 'supervisor' };
      const scaffold = { created_by: 99 };
      const project = { assigned_supervisor_id: 99 };
      let err;
      try {
        ScaffoldService.validateUserPermissions(user, scaffold, project);
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
    });

    it('supervisor con project null y no creador lanza 403', () => {
      const user = { id: 5, role: 'supervisor' };
      const scaffold = { created_by: 99 };
      let err;
      try {
        ScaffoldService.validateUserPermissions(user, scaffold, null);
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
    });

    it('role client lanza 403 (deny-by-default)', () => {
      const user = { id: 6, role: 'client' };
      const scaffold = { created_by: 99 };
      const project = { assigned_supervisor_id: 99 };
      let err;
      try {
        ScaffoldService.validateUserPermissions(user, scaffold, project);
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(403);
    });
  });

  // =====================================================
  // validateDisassembledImmutability
  // =====================================================

  describe('validateDisassembledImmutability', () => {
    it('andamio armado permite cualquier newData', () => {
      const scaffold = { assembly_status: 'assembled' };
      expect(() =>
        ScaffoldService.validateDisassembledImmutability(scaffold, { assembly_status: 'disassembled', progress_percentage: 50 })
      ).not.toThrow();
    });

    it('desarmado + newData.assembly_status assembled lanza 400', () => {
      const scaffold = { assembly_status: 'disassembled' };
      let err;
      try {
        ScaffoldService.validateDisassembledImmutability(scaffold, { assembly_status: 'assembled' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(400);
    });

    it('desarmado + progress_percentage 50 lanza 400', () => {
      const scaffold = { assembly_status: 'disassembled' };
      let err;
      try {
        ScaffoldService.validateDisassembledImmutability(scaffold, { progress_percentage: 50 });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(400);
    });

    it('desarmado + card_status green lanza 400', () => {
      const scaffold = { assembly_status: 'disassembled' };
      let err;
      try {
        ScaffoldService.validateDisassembledImmutability(scaffold, { card_status: 'green' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(400);
    });

    it('desarmado + card_status null no lanza', () => {
      const scaffold = { assembly_status: 'disassembled' };
      expect(() =>
        ScaffoldService.validateDisassembledImmutability(scaffold, { card_status: null })
      ).not.toThrow();
    });

    it('desarmado + newData vacío no lanza', () => {
      const scaffold = { assembly_status: 'disassembled' };
      expect(() =>
        ScaffoldService.validateDisassembledImmutability(scaffold, {})
      ).not.toThrow();
    });
  });

  // =====================================================
  // getScaffoldsByRole
  // =====================================================

  describe('getScaffoldsByRole', () => {
    it('admin llama Scaffold.getAll una vez y no getByCreator', async () => {
      Scaffold.getAll.mockResolvedValue([]);
      await ScaffoldService.getScaffoldsByRole({ id: 1, role: 'admin' });
      expect(Scaffold.getAll).toHaveBeenCalledTimes(1);
      expect(Scaffold.getByCreator).not.toHaveBeenCalled();
    });

    it('supervisor llama Scaffold.getByCreator con su userId', async () => {
      Scaffold.getByCreator.mockResolvedValue([]);
      await ScaffoldService.getScaffoldsByRole({ id: 7, role: 'supervisor' });
      expect(Scaffold.getByCreator).toHaveBeenCalledWith(7);
    });

    it('client con 2 proyectos distintos llama Scaffold.getByProjects con ambos ids', async () => {
      Project.getByAssignedClient.mockResolvedValue([{ id: 1 }]);
      Project.getForUser.mockResolvedValue([{ id: 2 }]);
      Scaffold.getByProjects.mockResolvedValue([]);
      await ScaffoldService.getScaffoldsByRole({ id: 10, role: 'client' });
      expect(Scaffold.getByProjects).toHaveBeenCalledWith([1, 2]);
      expect(Scaffold.getByProjects).toHaveBeenCalledTimes(1);
    });

    it('client con proyectos duplicados entre fuentes deduplica y llama getByProjects una vez', async () => {
      Project.getByAssignedClient.mockResolvedValue([{ id: 1 }]);
      Project.getForUser.mockResolvedValue([{ id: 1 }]);
      Scaffold.getByProjects.mockResolvedValue([]);
      await ScaffoldService.getScaffoldsByRole({ id: 11, role: 'client' });
      expect(Scaffold.getByProjects).toHaveBeenCalledTimes(1);
      expect(Scaffold.getByProjects).toHaveBeenCalledWith([1]);
    });

    it('rol desconocido rechaza con statusCode 403', async () => {
      await expect(
        ScaffoldService.getScaffoldsByRole({ id: 99, role: 'otro' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
