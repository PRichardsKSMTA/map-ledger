import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTemplateStore } from '../store/templateStore';
import { Plus, ArrowLeft } from 'lucide-react';
import TemplateList from '../components/templates/TemplateList';
import TemplateForm from '../components/templates/TemplateForm';
import DatapointForm from '../components/templates/DatapointForm';
import DatapointList from '../components/templates/DatapointList';
import { COATemplate, Datapoint } from '../types';

export default function Templates() {
  const { user } = useAuthStore();
  const { 
    templates, 
    datapoints,
    addTemplate, 
    updateTemplate, 
    deleteTemplate,
    addDatapoint,
    updateDatapoint,
    deleteDatapoint,
    reorderDatapoints
  } = useTemplateStore();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<COATemplate | undefined>();
  const [selectedTemplate, setSelectedTemplate] = useState<COATemplate | undefined>();
  const [isDatapointFormOpen, setIsDatapointFormOpen] = useState(false);
  const [editingDatapoint, setEditingDatapoint] = useState<Datapoint | undefined>();
  
  if (user?.role !== 'super') {
    return <div>Access denied</div>;
  }

  const handleTemplateEdit = (template: COATemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
    setSelectedTemplate(undefined);
  };

  const handleTemplateSubmit = (template: Omit<COATemplate, 'id'>) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, template);
    } else {
      addTemplate(template);
    }
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleTemplateCancel = () => {
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleTemplateSelect = (template: COATemplate) => {
    setSelectedTemplate(template);
    setIsFormOpen(false);
  };

  const handleDatapointSubmit = (datapoint: Omit<Datapoint, 'id' | 'templateId' | 'sortOrder'>) => {
    if (selectedTemplate) {
      if (editingDatapoint) {
        updateDatapoint(selectedTemplate.id, editingDatapoint.id, datapoint);
      } else {
        addDatapoint(selectedTemplate.id, datapoint);
      }
    }
    setIsDatapointFormOpen(false);
    setEditingDatapoint(undefined);
  };

  const handleDatapointEdit = (datapoint: Datapoint) => {
    setEditingDatapoint(datapoint);
    setIsDatapointFormOpen(true);
  };

  const handleBack = () => {
    setSelectedTemplate(undefined);
    setIsDatapointFormOpen(false);
    setEditingDatapoint(undefined);
  };

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="flex justify-between items-center">
          {selectedTemplate ? (
            <>
              <div className="flex items-center">
                <button
                  onClick={handleBack}
                  className="mr-4 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {selectedTemplate.name} - Datapoints
                </h1>
              </div>
              {!isDatapointFormOpen && (
                <button
                  onClick={() => setIsDatapointFormOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Datapoint
                </button>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900">COA Templates</h1>
              {!isFormOpen && (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="py-4">
          {selectedTemplate ? (
            isDatapointFormOpen ? (
              <div className="bg-white shadow rounded-lg p-6">
                <DatapointForm
                  template={selectedTemplate}
                  initialData={editingDatapoint}
                  onSubmit={handleDatapointSubmit}
                  onCancel={() => {
                    setIsDatapointFormOpen(false);
                    setEditingDatapoint(undefined);
                  }}
                />
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <DatapointList
                  template={selectedTemplate}
                  datapoints={datapoints[selectedTemplate.id] || []}
                  onEdit={handleDatapointEdit}
                  onDelete={(id) => deleteDatapoint(selectedTemplate.id, id)}
                  onReorder={(ids) => reorderDatapoints(selectedTemplate.id, ids)}
                />
              </div>
            )
          ) : isFormOpen ? (
            <div className="bg-white shadow rounded-lg p-6">
              <TemplateForm
                initialData={editingTemplate}
                onSubmit={handleTemplateSubmit}
                onCancel={handleTemplateCancel}
              />
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <TemplateList
                templates={templates}
                onEdit={handleTemplateEdit}
                onDelete={deleteTemplate}
                onSelect={handleTemplateSelect}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}