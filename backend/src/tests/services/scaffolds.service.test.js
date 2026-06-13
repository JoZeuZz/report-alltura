const ScaffoldService = require('../../services/scaffolds.service');
const Scaffold = require('../../models/scaffold');
const ScaffoldSection = require('../../models/scaffoldSection');
const ScaffoldHistory = require('../../models/scaffoldHistory');
const ScaffoldModification = require('../../models/scaffoldModification');
const Project = require('../../models/project');
const db = require('../../db');
const { uploadFile, deleteFileByUrl, resolveImageUrl } = require('../../lib/googleCloud');

jest.mock('../../models/scaffold');
jest.mock('../../models/scaffoldSection');
jest.mock('../../models/scaffoldHistory');
jest.mock('../../models/scaffoldModification');
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

describe('ScaffoldService', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValue(mockClient);
    resolveImageUrl.mockImplementation(async (value) => value);
  });

  describe('calculateCubicMeters', () => {
    it('debe calcular metros cúbicos correctamente', () => {
      expect(ScaffoldService.calculateCubicMeters(10, 5, 8)).toBe(400);
    });
  });

  describe('determineAssemblyState', () => {
    it('debe mapear 0 a disassembled sin tarjeta', () => {
      expect(ScaffoldService.determineAssemblyState(0)).toEqual({
        assembly_status: 'disassembled',
        card_status: null,
      });
    });

    it('debe mapear 1-99 a in_progress con tarjeta roja', () => {
      expect(ScaffoldService.determineAssemblyState(50)).toEqual({
        assembly_status: 'in_progress',
        card_status: 'red',
      });
    });

    it('debe mapear 100 a assembled con tarjeta roja', () => {
      expect(ScaffoldService.determineAssemblyState(100)).toEqual({
        assembly_status: 'assembled',
        card_status: 'red',
      });
    });
  });

  describe('createScaffold', () => {
    const user = { id: 1, role: 'supervisor' };
    const scaffoldData = {
      project_id: 1,
      permit_number: 'PERM-001',
      area: 'Zona Norte',
      tag: 'TAG-001',
      height: 10,
      width: 5,
      length: 8,
      progress_percentage: 0,
    };

    it('debe requerir imagen de montaje', async () => {
      await expect(ScaffoldService.createScaffold(scaffoldData, user)).rejects.toThrow(
        'La imagen de montaje es obligatoria.'
      );
    });

    it('debe lanzar error si el proyecto está inactivo', async () => {
      Project.getById.mockResolvedValue({ id: 1, active: false, client_active: true });

      await expect(
        ScaffoldService.createScaffold(scaffoldData, user, Buffer.from('img'))
      ).rejects.toThrow(/proyecto o cliente desactivado/i);
    });

    it('debe crear un andamio exitosamente', async () => {
      Project.getById.mockResolvedValue({
        id: 1,
        name: 'Proyecto Test',
        active: true,
        client_active: true,
        assigned_client_id: 99,
      });
      uploadFile.mockResolvedValue('https://gcs/img.png');
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ next_scaffold_number: 1 }] }) // lock project
        .mockResolvedValueOnce({}) // update counter
        .mockResolvedValueOnce({}); // COMMIT
      Scaffold.create.mockResolvedValue({ id: 10, ...scaffoldData, scaffold_number: '1' });
      ScaffoldSection.replaceForScaffold.mockResolvedValue([]);
      ScaffoldHistory.create.mockResolvedValue({});

      const result = await ScaffoldService.createScaffold(scaffoldData, user, Buffer.from('img'));

      expect(uploadFile).toHaveBeenCalled();
      expect(Scaffold.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 1,
          user_id: 1,
          scaffold_number: '1',
          permit_number: 'PERM-001',
          assembly_image_url: 'https://gcs/img.png',
          card_status: null,
          assembly_status: 'disassembled',
        }),
        mockClient
      );
      expect(ScaffoldSection.replaceForScaffold).toHaveBeenCalled();
      expect(ScaffoldHistory.create).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 10 });
    });
  });

  describe('disassembleScaffold', () => {
    const user = { id: 1, role: 'admin' };
    const scaffoldId = 42;
    const baseScaffold = {
      id: scaffoldId,
      project_id: 10,
      assembly_status: 'assembled',
      card_status: 'green',
      scaffold_number: 'A-001',
      area: 'Zona Sur',
      tag: 'TAG-X',
    };
    const activeProject = { id: 10, name: 'Proyecto Test', active: true, client_active: true, assigned_supervisor_id: 99 };
    const disassembledRow = { id: scaffoldId, assembly_status: 'disassembled', card_status: null };

    it('happy path: retorna andamio desarmado y no llama deleteFileByUrl', async () => {
      Scaffold.getById.mockResolvedValue(baseScaffold);
      Project.getById.mockResolvedValue(activeProject);
      uploadFile.mockResolvedValue('gs://img');
      db.query.mockResolvedValue({ rows: [disassembledRow] });
      ScaffoldHistory.create.mockResolvedValue({});

      const result = await ScaffoldService.disassembleScaffold(scaffoldId, user, Buffer.from('img'), 'notas');

      expect(uploadFile).toHaveBeenCalledTimes(1);
      expect(deleteFileByUrl).not.toHaveBeenCalled();
      expect(ScaffoldHistory.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ id: scaffoldId, assembly_status: 'disassembled' });
    });

    it('UPDATE devuelve rows vacíos → rechaza 404 y llama deleteFileByUrl', async () => {
      Scaffold.getById.mockResolvedValue(baseScaffold);
      Project.getById.mockResolvedValue(activeProject);
      uploadFile.mockResolvedValue('gs://img');
      db.query.mockResolvedValue({ rows: [] });
      deleteFileByUrl.mockResolvedValue();

      await expect(
        ScaffoldService.disassembleScaffold(scaffoldId, user, Buffer.from('img'), null)
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(deleteFileByUrl).toHaveBeenCalledWith('gs://img');
    });

    it('db.query rechaza → error se propaga y llama deleteFileByUrl', async () => {
      Scaffold.getById.mockResolvedValue(baseScaffold);
      Project.getById.mockResolvedValue(activeProject);
      uploadFile.mockResolvedValue('gs://img');
      db.query.mockRejectedValue(new Error('DB error'));
      deleteFileByUrl.mockResolvedValue();

      await expect(
        ScaffoldService.disassembleScaffold(scaffoldId, user, Buffer.from('img'), null)
      ).rejects.toThrow('DB error');

      expect(deleteFileByUrl).toHaveBeenCalledWith('gs://img');
    });

    it('ScaffoldHistory.create rechaza → error se propaga y llama deleteFileByUrl', async () => {
      Scaffold.getById.mockResolvedValue(baseScaffold);
      Project.getById.mockResolvedValue(activeProject);
      uploadFile.mockResolvedValue('gs://img');
      db.query.mockResolvedValue({ rows: [disassembledRow] });
      ScaffoldHistory.create.mockRejectedValue(new Error('historial error'));
      deleteFileByUrl.mockResolvedValue();

      await expect(
        ScaffoldService.disassembleScaffold(scaffoldId, user, Buffer.from('img'), null)
      ).rejects.toThrow('historial error');

      expect(deleteFileByUrl).toHaveBeenCalledWith('gs://img');
    });

    it('sin imageFile → rechaza 400 y no llama uploadFile', async () => {
      Scaffold.getById.mockResolvedValue(baseScaffold);
      Project.getById.mockResolvedValue(activeProject);

      await expect(
        ScaffoldService.disassembleScaffold(scaffoldId, user, null, null)
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('updateAssemblyStatus', () => {
    const user = { id: 1, role: 'supervisor' };

    it('debe lanzar error si el andamio no existe', async () => {
      Scaffold.getById.mockResolvedValue(null);

      await expect(
        ScaffoldService.updateAssemblyStatus(1, 'assembled', user)
      ).rejects.toThrow('Andamio no encontrado.');
    });

    it('debe requerir imagen al desarmar', async () => {
      Scaffold.getById.mockResolvedValue({ id: 1, project_id: 1, assembly_status: 'assembled' });
      Project.getById.mockResolvedValue({ id: 1, assigned_supervisor_id: 1 });

      await expect(
        ScaffoldService.updateAssemblyStatus(1, 'disassembled', user)
      ).rejects.toThrow('Se requiere imagen de desarmado.');
    });

    it('debe actualizar estado de armado', async () => {
      Scaffold.getById.mockResolvedValue({
        id: 1,
        project_id: 1,
        assembly_status: 'assembled',
        card_status: 'green',
        scaffold_number: 'A-001',
      });
      Project.getById.mockResolvedValue({ id: 1, assigned_supervisor_id: 1 });
      uploadFile.mockResolvedValue('https://gcs/disassembly.png');
      Scaffold.updateAssemblyStatus.mockResolvedValue({
        id: 1,
        assembly_status: 'disassembled',
        card_status: null,
      });
      ScaffoldHistory.create.mockResolvedValue({});

      const result = await ScaffoldService.updateAssemblyStatus(
        1,
        'disassembled',
        user,
        Buffer.from('img')
      );

      expect(Scaffold.updateAssemblyStatus).toHaveBeenCalledWith(
        1,
        'disassembled',
        'https://gcs/disassembly.png'
      );
      expect(ScaffoldHistory.create).toHaveBeenCalled();
      expect(result).toMatchObject({ id: 1, assembly_status: 'disassembled' });
    });
  });

  describe('getScaffoldsByProject', () => {
    it('2 andamios: enriquece con totals y sections del bulk, 0 para ids ausentes', async () => {
      Scaffold.getByProject.mockResolvedValue([
        { id: 10, cubic_meters: '5.0' },
        { id: 20, cubic_meters: '3.0' },
      ]);
      ScaffoldModification.getTotalApprovedCubicMetersBulk.mockResolvedValue(
        new Map([[10, 2.5]])
      );
      ScaffoldSection.getByScaffolds.mockResolvedValue(
        new Map([[20, [{ id: 1, section_order: 1 }]]])
      );

      const result = await ScaffoldService.getScaffoldsByProject(99);

      expect(ScaffoldModification.getTotalApprovedCubicMetersBulk).toHaveBeenCalledWith([10, 20]);
      expect(ScaffoldSection.getByScaffolds).toHaveBeenCalledWith([10, 20]);

      const s10 = result.find((s) => s.id === 10);
      expect(s10.additional_cubic_meters).toBe(2.5);
      expect(s10.total_cubic_meters).toBeCloseTo(7.5);
      expect(s10.sections).toEqual([]);

      const s20 = result.find((s) => s.id === 20);
      expect(s20.additional_cubic_meters).toBe(0);
      expect(s20.total_cubic_meters).toBeCloseTo(3.0);
      expect(s20.sections).toEqual([{ id: 1, section_order: 1 }]);
    });

    it('0 andamios → retorna [] y no llama los bulk', async () => {
      Scaffold.getByProject.mockResolvedValue([]);

      const result = await ScaffoldService.getScaffoldsByProject(99);

      expect(result).toEqual([]);
      expect(ScaffoldModification.getTotalApprovedCubicMetersBulk).not.toHaveBeenCalled();
      expect(ScaffoldSection.getByScaffolds).not.toHaveBeenCalled();
    });
  });
});
