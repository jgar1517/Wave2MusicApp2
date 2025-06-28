import React, { useState, useEffect } from 'react';
import { Plus, Music, Trash2, Edit3, Calendar, Clock } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';

const ProjectManager: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  
  const {
    projects,
    currentProject,
    loading,
    createProject,
    deleteProject,
    loadProjects,
    setCurrentProject,
  } = useProjectStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    const project = await createProject(newProjectTitle, newProjectDescription);
    if (project) {
      setNewProjectTitle('');
      setNewProjectDescription('');
      setShowCreateModal(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-dark-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-righteous text-xl text-neon-green">Projects</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-neon-green to-neon-blue text-white px-4 py-2 rounded-lg font-medium hover:shadow-neon-sm transition-all duration-300 transform hover:scale-105 flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="text-center text-gray-400 py-8">
            <div className="animate-spin w-6 h-6 border-2 border-neon-blue border-t-transparent rounded-full mx-auto mb-2" />
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No projects yet</p>
            <p className="text-sm">Create your first project to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                currentProject?.id === project.id
                  ? 'border-neon-blue bg-neon-blue/10'
                  : 'border-gray-600 hover:border-gray-500 bg-dark-700/50'
              }`}
              onClick={() => setCurrentProject(project)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1">{project.title}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-400 mb-2">{project.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(project.created_at)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{project.status}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement edit functionality
                    }}
                    className="text-gray-400 hover:text-neon-blue transition-colors duration-200"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="text-gray-400 hover:text-red-400 transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-dark-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-righteous text-xl text-neon-green mb-4">
              Create New Project
            </h3>
            
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-neon-green transition-colors duration-200"
                  placeholder="Enter project title"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full bg-dark-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-neon-green transition-colors duration-200 resize-none"
                  placeholder="Describe your project"
                  rows={3}
                />
              </div>
              
              <div className="flex items-center space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-neon-green to-neon-blue text-white py-3 rounded-lg font-semibold hover:shadow-neon-sm transition-all duration-300"
                >
                  Create Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-700 text-white py-3 rounded-lg font-semibold hover:bg-gray-600 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager;