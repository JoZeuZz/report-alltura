import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ImageUploadIcon from '../../components/icons/ImageUploadIcon';

const NewScaffoldPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState({ height: '', width: '', depth: '' });
  const [cubicMeters, setCubicMeters] = useState(0);
  const [progress, setProgress] = useState(100);
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const { height, width, depth } = dimensions;
    if (height > 0 && width > 0 && depth > 0) {
      const vol = (parseFloat(height) * parseFloat(width) * parseFloat(depth)).toFixed(2);
      setCubicMeters(vol);
    } else {
      setCubicMeters(0);
    }
  }, [dimensions]);

  const handleDimensionChange = (e) => {
    const { name, value } = e.target;
    setDimensions(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image || dimensions.height <= 0 || dimensions.width <= 0 || dimensions.depth <= 0) {
      setError('Por favor, complete todos los campos de dimensiones y adjunte una imagen.');
      return;
    }

    setSubmitting(true);
    setError('');

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('height', dimensions.height);
    formData.append('width', dimensions.width);
    formData.append('depth', dimensions.depth);
    formData.append('progress_percentage', progress);
    formData.append('assembly_notes', notes);
    formData.append('assembly_image', image);

    try {
      await api.post('/scaffolds', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      navigate(`/tech/project/${projectId}`);
    } catch (err) {
      setError('Error al enviar el reporte. Intente de nuevo.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 text-primary-blue hover:underline">&larr; Volver al Proyecto</button>
      <h1 className="text-3xl font-bold text-dark-blue mb-6">Nuevo Reporte de Montaje</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-lg shadow-md">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Foto del Montaje</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              {imagePreview ? (
                <img src={imagePreview} alt="Vista previa" className="mx-auto h-48 w-auto rounded-md" />
              ) : (
                <ImageUploadIcon />
              )}
              <div className="flex text-sm text-gray-600 justify-center">
                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-blue hover:text-blue-700 focus-within:outline-none">
                  <span>{image ? 'Cambiar foto' : 'Adjuntar una foto'}</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" capture="environment" onChange={handleImageChange} ref={fileInputRef} />
                </label>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF hasta 10MB</p>
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Dimensiones (metros)</label>
          <div className="grid grid-cols-3 gap-4">
            <input type="number" name="height" placeholder="Alto" value={dimensions.height} onChange={handleDimensionChange} className="form-input" step="0.01" required />
            <input type="number" name="width" placeholder="Ancho" value={dimensions.width} onChange={handleDimensionChange} className="form-input" step="0.01" required />
            <input type="number" name="depth" placeholder="Prof." value={dimensions.depth} onChange={handleDimensionChange} className="form-input" step="0.01" required />
          </div>
        </div>

        {/* Cubic Meters */}
        <div className="p-4 bg-light-gray-bg rounded-lg text-center">
          <p className="text-lg text-neutral-gray">Volumen Calculado</p>
          <p className="text-3xl font-bold text-dark-blue">{cubicMeters} m³</p>
        </div>

        {/* Progress */}
        <div>
          <label htmlFor="progress" className="block text-sm font-bold text-gray-700">Progreso de Montaje: {progress}%</label>
          <input id="progress" type="range" min="0" max="100" value={progress} onChange={(e) => setProgress(e.target.value)} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-bold text-gray-700">Notas (Opcional)</label>
          <textarea id="notes" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input"></textarea>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {/* Submit */}
        <div className="pt-5">
          <button type="submit" disabled={submitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-primary-blue hover:bg-blue-700 focus:outline-none disabled:bg-gray-400">
            {submitting ? 'Enviando...' : 'Enviar Reporte'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewScaffoldPage;