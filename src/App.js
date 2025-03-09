import React, { Component } from 'react';
import axios from 'axios';
import { 
  Box, 
  Tabs, 
  Tab, 
  Button, 
  Typography,
  TextField,
  AppBar,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  LinearProgress,
  Paper,
  Collapse,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import WarningIcon from '@mui/icons-material/Warning';
import './App.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import * as d3 from 'd3';
import { InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import StopIcon from '@mui/icons-material/Stop';
import ScissorsIcon from '@mui/icons-material/ContentCut';
import BarChartIcon from '@mui/icons-material/BarChart';
import GridViewIcon from '@mui/icons-material/GridView';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

class ModelTab extends Component {
  constructor(props) {
    super(props);
    this.state = {
      modelData: null,
      error: null,
      loading: false,
      selectedDataset: "",
      selectedModel: "",
      isTraining: false,
      trainingProgress: 0,  // Add this for progress tracking
      trainingStatus: "",   // Add this for status messages
      modelExists: false,
      inputText: "",
      classificationResult: null,
      classifying: false,
      classificationError: null,
      chartView: 'bar',  // Add this to track which visualization to show
      simulation: null,
      numConceptsToShow: 5,  // Add this
      selectedConcept: null,  // Add this to track which concept is selected
      conceptDialogOpen: false,  // Add this to control dialog visibility
      showAllConcepts: false,  // Add this new state property
      conceptFilter: 'all', // Add this for filtering concepts
      jsonExpanded: false,
      isPruningMode: false,
      conceptsToPrune: new Set(),
      searchQuery: '',
      biasedConcepts: null,
      loadingBiasAnalysis: false,
      biasAnalysisError: null,
      pruningSuccess: false,
      successMessage: '',
      accuracyInfo: props.metadata || null,
      isPruning: false,  // Add this new state variable
      hoverInfo: null,
      mousePosition: { x: 0, y: 0 }  // Add mouse position tracking
    };
    this.bubbleChartRef = React.createRef();
  }

  componentDidMount() {
    this.fetchModelData();
  }

  componentWillUnmount() {
    if (this.state.simulation) {
      this.state.simulation.stop();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Check if we need to update the force simulation
    if (this.state.classificationResult !== prevState.classificationResult ||
        this.state.chartView !== prevState.chartView) {
      this.updateForceSimulation();
    }
  }

  updateForceSimulation = () => {
    const { classificationResult, chartView } = this.state;
    if (!classificationResult || !classificationResult.top_concepts || chartView !== 'bubble') return;

    // Stop any existing simulation
    if (this.state.simulation) {
      this.state.simulation.stop();
    }

    const containerNode = this.bubbleChartRef.current;
    if (!containerNode) return;

    const width = containerNode.offsetWidth;
    const height = containerNode.offsetHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // Increase base size of bubbles and start them very close to center
    const bubbleData = classificationResult.top_concepts.map(item => ({
      radius: Math.max(35, item.activation * 45), // Match the sizes from simulation
      concept: item.concept,
      activation: item.activation,
      x: centerX + (Math.random() - 0.5) * 50,  // Start very close to center (reduced from 100)
      y: centerY + (Math.random() - 0.5) * 50   // Start very close to center (reduced from 100)
    }));

    // Create force simulation with much stronger center gravity
    const simulation = d3.forceSimulation(bubbleData)
      .force('center', d3.forceCenter(centerX, centerY).strength(0.3)) // Doubled center force
      .force('charge', d3.forceManyBody().strength(-10)) // Reduced repulsion
      .force('collide', d3.forceCollide().radius(d => d.radius + 2).strength(0.9)) // Stronger collision
      .force('x', d3.forceX(centerX).strength(0.2)) // Stronger X centering
      .force('y', d3.forceY(centerY).strength(0.2)) // Stronger Y centering
      .velocityDecay(0.4) // Slower movement
      .on('tick', () => {
        const bubbles = containerNode.getElementsByClassName('bubble');
        
        Array.from(bubbles).forEach((bubble, index) => {
          const d = bubbleData[index];
          if (d && bubble) {
            // Keep bubbles more tightly bound to center
            const maxDistance = Math.min(width, height) * 0.4; // Restrict to 40% of container
            const dx = d.x - centerX;
            const dy = d.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > maxDistance) {
              const angle = Math.atan2(dy, dx);
              d.x = centerX + Math.cos(angle) * maxDistance;
              d.y = centerY + Math.sin(angle) * maxDistance;
            }
            
            bubble.style.transform = `translate(${d.x - d.radius}px, ${d.y - d.radius}px)`;
          }
        });
      });

    this.setState({ simulation });
  };

  fetchModelData = async () => {
    try {
      this.setState({ loading: true });
      const response = await axios.get(`http://127.0.0.1:5050/process-model/?model_id=${this.props.modelId}`);
      
      // Check if model exists by checking if response.data is not null AND has properties
      const modelExists = response.data !== null && Object.keys(response.data).length > 0;
      console.log('Model data received:', response.data); // Debug log
      console.log('Model exists:', modelExists); // Debug log
      
      if (modelExists) {
        // Set both the model data and the selected options from the response
        this.setState({ 
          modelData: response.data,
          selectedDataset: response.data.concept_dataset,
          selectedModel: response.data.backbone,
          modelExists: true,
          loading: false
        });
      } else {
        this.setState({
          modelData: null,
          modelExists: false,
          loading: false
        });
      }
    } catch (error) {
      this.setState({ 
        error: 'Error fetching data from server',
        loading: false,
        modelExists: false
      });
      console.error('Error:', error);
    }
  };

  handleTrainClick = async () => {
    const { selectedDataset, selectedModel } = this.state;
    
    try {
      this.setState({ 
        isTraining: true,
        trainingStatus: "Starting training process...",
        trainingProgress: 0,
        error: null  // Clear any previous errors
      });

      const response = await axios.post('http://127.0.0.1:5050/process-model/', {
        concept_dataset: selectedDataset,
        model_type: "LLM",
        backbone: selectedModel,
        model_id: this.props.modelId,
        hardware: "Local Hardware"
      });

      if (response.data.status === "success") {
        this.setState({
          trainingStatus: "Training completed successfully!",
          trainingProgress: 100
        });
        await this.fetchModelData();
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error("Training Error:", error);
      const errorMessage = error.response?.data?.message || error.message;
      this.setState({ 
        trainingStatus: "Training failed. Please check logs.",
        error: `Training failed: ${errorMessage}`,
        trainingProgress: 0
      });
    } finally {
      this.setState({ isTraining: false });
    }
  };

  handleClassify = async () => {
    const { inputText, selectedDataset } = this.state;
    
    try {
      this.setState({ 
        classifying: true,
        classificationError: null,
        classificationResult: null
      });

      const response = await axios.post('http://127.0.0.1:5050/classify-model/', {
        model_id: this.props.modelId,
        concept_dataset: selectedDataset,
        input: inputText
      });

      this.setState({
        classificationResult: {
          ...response.data,
          pruned_concepts: response.data.pruned_concepts || []
        },
        classifying: false
      });
    } catch (error) {
      console.error("Classification Error:", error);
      const errorMessage = error.response?.data?.error || error.message;
      this.setState({ 
        classificationError: `Classification failed: ${errorMessage}`,
        classifying: false
      });
    }
  };

  handleChartViewChange = (event, newView) => {
    if (newView !== null) {
      this.setState({ chartView: newView });
    }
  };

  handleDownload = async () => {
    try {
      const response = await axios({
        url: `http://127.0.0.1:5050/download-model/?model_id=${this.props.modelId}`,
        method: 'GET',
        responseType: 'blob',  // Important for handling binary data
      });

      // Create a blob from the response data
      const blob = new Blob([response.data], { type: 'application/zip' });
      
      // Create a link element and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `model_${this.props.modelId}.zip`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      this.setState({ 
        error: 'Failed to download model files. Please try again.' 
      });
    }
  };

  handleShowMoreConcepts = () => {
    this.setState(prevState => ({
      numConceptsToShow: prevState.numConceptsToShow + 5
    }));
  };

  handleShowLessConcepts = () => {
    this.setState({ showAllConcepts: false });
  };

  handleConceptCardClick = (concept) => {
    this.setState({
      selectedConcept: concept,
      conceptDialogOpen: true
    });
  };

  handleDialogClose = () => {
    this.setState({
      conceptDialogOpen: false
    });
  };

  getPredictionText = (prediction) => {
    // Flip the interpretation - 0 is Negative, 1 is Positive
    return prediction === 1 ? "Positive" : "Negative";
  };

  getConceptImpactDescription = (conceptActivation, maxActivation, finalPrediction) => {
    const relativeStrength = conceptActivation / maxActivation;
    const sentiment = this.getPredictionText(finalPrediction).toLowerCase();
    
    if (conceptActivation === 0) {
      return {
        text: 'No contribution to classification',
        strengthWord: '',
        color: 'text.secondary'
      };
    }
    
    if (relativeStrength > 0.8) {
      return {
        text: 'supports classification',
        strengthWord: 'Strongly',
        color: '#2e7d32' // Strong green
      };
    }
    
    if (relativeStrength > 0.5) {
      return {
        text: 'supports classification',
        strengthWord: 'Moderately',
        color: '#ffd700' // Gold/yellow
      };
    }
    
    if (relativeStrength > 0.2) {
      return {
        text: 'supports classification',
        strengthWord: 'Weakly',
        color: '#ffa726' // Orange
      };
    }
    
    return {
      text: 'supports classification',
      strengthWord: 'Minimally',
      color: '#ffb74d' // Light orange
    };
  };

  handleExpandAllConcepts = () => {
    this.setState({ showAllConcepts: true });
  };

  handleFilterChange = (filter) => {
    this.setState({ conceptFilter: filter });
  };

  handleSearchChange = (value) => {
    this.setState({ searchQuery: value });
  };

  handleConceptPruneSelect = (concept) => {
    this.setState(prevState => {
      const newConceptsToPrune = new Set(prevState.conceptsToPrune);
      if (newConceptsToPrune.has(concept)) {
        newConceptsToPrune.delete(concept);
      } else {
        newConceptsToPrune.add(concept);
      }
      return { conceptsToPrune: newConceptsToPrune };
    });
  };

  handleBiasDetection = async () => {
    const { classificationResult } = this.state;
    
    if (!classificationResult) {
      console.log('No classification result available');
      return;
    }

    console.log('Sending classification data:', classificationResult);
    this.setState({ loadingBiasAnalysis: true });
    
    try {
      const response = await axios.post('http://localhost:5050/detect-bias/', {
        classification_data: classificationResult
      });
      
      console.log('Received bias analysis:', response.data);
      
      if (!response.data.biased_concepts) {
        console.error('No biased_concepts in response:', response.data);
        return;
      }

      this.setState({ 
        biasedConcepts: response.data.biased_concepts,
        conceptFilter: 'biased'
      }, () => {
        console.log('Updated state:', this.state.biasedConcepts);
      });
    } catch (error) {
      console.error('Error detecting bias:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      // Add user feedback
      this.setState({ 
        biasAnalysisError: error.response?.data?.error || 'Failed to analyze bias'
      });
    } finally {
      this.setState({ loadingBiasAnalysis: false });
    }
  };

  handlePruneConcepts = async () => {
    const { conceptsToPrune, classificationResult } = this.state;
    
    if (conceptsToPrune.size === 0) {
      console.log("No concepts to prune");
      return;
    }

    try {
      console.log("Starting pruning process with concepts:", [...conceptsToPrune]);
      this.setState({
        isPruningMode: false,
        isPruning: true,
        isLoading: true,
        error: null
      });
      
      // Create a temporary ID for the pruning tab
      const timestamp = new Date().getTime();
      const tempModelId = `${this.props.modelId}_pruning_${timestamp}`;
      console.log("Created temporary model ID:", tempModelId);

      // Create a tab immediately to show pruning progress
      this.props.addPrunedModel(tempModelId, {
        isPruningInProgress: true,
        prunedConcepts: Array.from(conceptsToPrune)
      });
      
      // Get the concept indices if classification result is available
      let conceptIndices = [];
      if (classificationResult && classificationResult.top_concepts) {
        // Create a map of concept names to their indices
        const conceptMap = {};
        classificationResult.top_concepts.forEach((concept, index) => {
          conceptMap[concept.concept] = index;
        });
        
        // Get the indices of the concepts to prune
        conceptIndices = Array.from(conceptsToPrune)
          .map(concept => conceptMap[concept])
          .filter(index => index !== undefined);
        
        console.log("Pruning concept indices:", conceptIndices);
      }
      
      console.log("Calling prune-concepts API...");
      const response = await axios.post('http://127.0.0.1:5050/prune-concepts/', {
        model_id: this.props.modelId,
        concepts_to_prune: Array.from(conceptsToPrune),
        concept_indices: conceptIndices,
        use_indices: conceptIndices.length > 0
      });

      console.log("Pruning API response:", response.data);
      
      if (response.data.success) {
        const prunedModelId = response.data.pruned_model_id;
        console.log("Pruning successful, got pruned model ID:", prunedModelId);
        
        // Check if evaluation was already completed by the backend
        if (response.data.evaluation_completed) {
          // Evaluation was done by the backend, update with complete data
          this.props.updatePrunedModel(tempModelId, prunedModelId, {
            originalAccuracy: response.data.original_accuracy,
            prunedAccuracy: response.data.pruned_accuracy,
            accuracyChange: response.data.accuracy_change,
            prunedConcepts: Array.from(conceptsToPrune),
            isPruningInProgress: false,
            evaluationPending: false
          });
          
          // Final UI update
          this.setState({
            isLoading: false,
            isPruning: false,
            isEvaluating: false,
            pruningSuccess: true,
            successMessage: `Successfully pruned ${conceptsToPrune.size} concepts. Model accuracy: ${response.data.pruned_accuracy.toFixed(2)}%`,
            accuracyInfo: {
              originalAccuracy: response.data.original_accuracy,
              prunedAccuracy: response.data.pruned_accuracy,
              accuracyChange: response.data.accuracy_change,
              prunedConcepts: Array.from(conceptsToPrune)
            }
          });
        } else {
          // Otherwise, proceed with showing progress and calling evaluation
          // (existing code for evaluation)
        }
      }
    } catch (error) {
      // Existing error handling
    }
  };

  handleTogglePruningMode = () => {
    console.log("Toggling pruning mode");
    this.setState(prev => {
      console.log("Previous pruning mode:", prev.isPruningMode);
      return { 
        isPruningMode: !prev.isPruningMode,
        conceptsToPrune: new Set() // Clear selections when toggling
      };
    }, () => {
      // Log after state update to confirm it worked
      console.log("Pruning mode is now:", this.state.isPruningMode);
    });
  };

  handleSelectConceptForPruning = (concept) => {
    if (!this.state.isPruningMode) return;
    
    const conceptName = typeof concept === 'object' ? concept.concept : concept;
    
    console.log("Selecting concept for pruning:", conceptName);
    console.log("Before update - pruning set:", [...this.state.conceptsToPrune]);
    
    this.setState(prevState => {
      const newConceptsToPrune = new Set(prevState.conceptsToPrune);
      
      if (newConceptsToPrune.has(conceptName)) {
        newConceptsToPrune.delete(conceptName);
        console.log(`Removed ${conceptName} from pruning set`);
      } else {
        newConceptsToPrune.add(conceptName);
        console.log(`Added ${conceptName} to pruning set`);
      }
      
      console.log("After update - pruning set:", [...newConceptsToPrune]);
      return { conceptsToPrune: newConceptsToPrune };
    }, () => {
      // Force update to ensure UI syncs with state
      console.log("After setState - pruning set:", [...this.state.conceptsToPrune]);
      this.forceUpdate();
    });
  };

  handleMouseMove = (e) => {
    this.setState({
      mousePosition: { x: e.clientX, y: e.clientY }
    });
  }

  renderPruningProgress = () => {
    const { metadata } = this.props;
    
    if (!metadata || !metadata.isPruningInProgress) return null;
    
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: 500,
        width: '100%'
      }}>
        <CircularProgress size={60} sx={{ mb: 4 }} />
        <Typography variant="h5" sx={{ mb: 2 }}>
          Pruning Concepts...
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Creating a new model with {metadata.prunedConcepts?.length || 0} pruned concepts
        </Typography>
        <Box sx={{ mt: 4, width: '100%', maxWidth: 600 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Pruning Progress:
          </Typography>
          <LinearProgress sx={{ height: 10, borderRadius: 5 }} />
        </Box>
      </Box>
    );
  };

  renderConceptChart = () => {
    const { 
      classificationResult, 
      hoverInfo, 
      mousePosition, 
      isPruningMode, 
      conceptsToPrune 
    } = this.state;
    
    if (!classificationResult || !classificationResult.top_concepts) return null;

    // Get top 10 concepts and prepare data for the chart
    const chartData = classificationResult.top_concepts
      .slice(0, 10)
      .map(item => ({
        concept: item.concept,
        activation: parseFloat(item.activation.toFixed(4))
      }));

    // Get top 10 contributions for the predicted class
    const prediction = classificationResult.final_prediction;
    const contributionData = classificationResult.top_concepts
      .slice(0, 10)
      .map(item => ({
        concept: item.concept,
        contribution: item.contributions && item.contributions[`class_${prediction}`] 
          ? parseFloat(item.contributions[`class_${prediction}`].toFixed(4)) 
          : 0
      }));

    const handleActivationBarMouseEnter = (data, index, e) => {
      this.setState({
        hoverInfo: {
          concept: data.payload.concept,
          value: data.payload.activation,
          isContribution: false
        }
      });
    };

    const handleContributionBarMouseEnter = (data, index, e) => {
      this.setState({
        hoverInfo: {
          concept: data.payload.concept,
          value: data.payload.contribution,
          isContribution: true
        }
      });
    };

    const handleBarMouseLeave = () => {
      this.setState({ hoverInfo: null });
    };

    // Add a handler for clicking bars to toggle pruning selection
    const handleBarClick = (data) => {
      if (!isPruningMode) return;
      
      const concept = data.payload.concept;
      const newConceptsToPrune = new Set(conceptsToPrune);
      
      if (newConceptsToPrune.has(concept)) {
        newConceptsToPrune.delete(concept);
      } else {
        newConceptsToPrune.add(concept);
      }
      
      this.setState({ conceptsToPrune: newConceptsToPrune });
    };

    return (
      <Box 
        sx={{ mt: 3, position: 'relative' }}
        onMouseMove={this.handleMouseMove}
      >
        {/* Custom tooltip */}
        {hoverInfo && (
          <div
            style={{
              position: 'fixed',
              top: mousePosition.y - 70,
              left: mousePosition.x + 10,
              backgroundColor: 'white',
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>{hoverInfo.concept}</div>
            <div>
              {hoverInfo.isContribution ? 'Contribution' : 'Activation'}: 
              <span style={{ 
                color: hoverInfo.isContribution 
                  ? (hoverInfo.value >= 0 ? '#4caf50' : '#f44336')
                  : '#8884d8',
                fontWeight: 'bold'
              }}>
                {' '}{hoverInfo.value.toFixed(4)}
              </span>
            </div>
            {hoverInfo.isContribution && (
              <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic' }}>
                {hoverInfo.value >= 0 ? 'Supports' : 'Opposes'} the {this.getPredictionText(prediction)} prediction
              </div>
            )}
            {isPruningMode && (
              <div style={{ fontSize: '12px', marginTop: '4px', fontStyle: 'italic', color: '#ff5722' }}>
                {conceptsToPrune.has(hoverInfo.concept) 
                  ? 'Selected for pruning' 
                  : 'Click to select for pruning'}
              </div>
            )}
          </div>
        )}

        {/* Activation Chart */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Top 10 Concept Activations
            {isPruningMode && (
              <span style={{ color: '#ff5722', fontSize: '0.8em', marginLeft: '10px' }}>
                (Click bars to select concepts for pruning)
              </span>
            )}
          </Typography>
          <div className="chart-container" style={{ 
            width: '100%', 
            height: '400px', 
            position: 'relative',
            cursor: isPruningMode ? 'pointer' : 'default'
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 30,
                  left: 0,
                  bottom: 5
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 'auto']} />
                <YAxis 
                  type="category" 
                  dataKey="concept" 
                  width={250}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                />
                <Bar 
                  dataKey="activation" 
                  name="Activation Score"
                  onMouseEnter={handleActivationBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  onClick={handleBarClick}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={conceptsToPrune.has(entry.concept) ? '#ff5722' : '#8884d8'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Box>
        
        {/* Contribution Chart */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Concept Contributions to {this.getPredictionText(prediction)} Class
            {isPruningMode && (
              <span style={{ color: '#ff5722', fontSize: '0.8em', marginLeft: '10px' }}>
                (Click bars to select concepts for pruning)
              </span>
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Positive values (green) support this prediction, negative values (red) oppose it
          </Typography>
          <div style={{ 
            width: '100%', 
            height: '400px', 
            position: 'relative',
            cursor: isPruningMode ? 'pointer' : 'default'
          }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contributionData}
                layout="vertical"
                margin={{
                  top: 5,
                  right: 30,
                  left: 0,
                  bottom: 5
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={['auto', 'auto']} />
                <YAxis 
                  type="category" 
                  dataKey="concept" 
                  width={250}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                />
                <Bar 
                  dataKey="contribution" 
                  name="Contribution"
                  onMouseEnter={handleContributionBarMouseEnter}
                  onMouseLeave={handleBarMouseLeave}
                  onClick={handleBarClick}
                >
                  {contributionData.map((entry, index) => {
                    // If concept is selected for pruning, use orange/red
                    if (conceptsToPrune.has(entry.concept)) {
                      return <Cell key={`cell-${index}`} fill="#ff5722" />;
                    }
                    // Otherwise use standard green/red based on contribution value
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.contribution >= 0 ? '#4caf50' : '#f44336'} 
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Box>
      </Box>
    );
  };

  renderBubbleChart = () => {
    const { classificationResult } = this.state;
    if (!classificationResult || !classificationResult.top_concepts) return null;

    // Only take top 5 concepts for clearer visualization
    const bubbleData = classificationResult.top_concepts
      .slice(0, 5)  // Changed from all concepts to just top 5
      .map(item => ({
        radius: Math.max(45, item.activation * 60), // Increased base size since we have fewer bubbles
        concept: item.concept,
        activation: item.activation
      }));

    return (
      <Box sx={{ mt: 3, height: 500 }}> {/* Reduced height since we have fewer bubbles */}
        <Typography variant="h6">Top 5 Concept Activations</Typography>
        <Box 
          ref={this.bubbleChartRef}
          sx={{ 
            mt: 2,
            height: 'calc(100% - 40px)',
            position: 'relative',
            bgcolor: '#fff',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          {bubbleData.map((bubble, index) => (
            <Box
              key={index}
              className="bubble"
              sx={{
                position: 'absolute',
                width: bubble.radius * 2,
                height: bubble.radius * 2,
                borderRadius: '50%',
                bgcolor: `hsla(${240 + (bubble.activation * 30)}, 70%, 60%, 0.7)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'transform 0.3s ease, background-color 0.3s ease',
                '&:hover': {
                  zIndex: 10,
                  bgcolor: `hsla(${240 + (bubble.activation * 30)}, 70%, 60%, 0.9)`,
                  transform: 'scale(1.1)',
                  '& .activation-tooltip': {
                    opacity: 1,
                    visibility: 'visible'
                  }
                }
              }}
            >
              <Typography
                sx={{
                  fontSize: Math.max(14, bubble.radius / 3), // Slightly larger font size
                  color: 'white',
                  textAlign: 'center',
                  padding: 1,
                  wordBreak: 'break-word',
                  WebkitLineClamp: 3,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                  userSelect: 'none'
                }}
              >
                {bubble.concept}
              </Typography>
              <Box
                className="activation-tooltip"
                sx={{
                  position: 'absolute',
                  top: '-40px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  opacity: 0,
                  visibility: 'hidden',
                  transition: 'opacity 0.2s ease',
                  whiteSpace: 'nowrap',
                  zIndex: 20
                }}
              >
                Activation: {bubble.activation.toFixed(3)}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  renderPrunedLegend = () => {
    const { classificationResult } = this.state;
    
    if (!classificationResult?.is_pruned_model) return null;
    
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: 2,
        mt: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid rgba(0,0,0,0.1)'
      }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>Legend:</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ 
            width: 12, 
            height: 12, 
            bgcolor: '#f4433699', 
            border: '1px dashed #f44336',
            borderRadius: 0.5 
          }} />
          <Typography variant="body2">Pruned concept (weight = 0)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ 
            width: 12, 
            height: 12, 
            bgcolor: '#2196f3', 
            borderRadius: 0.5 
          }} />
          <Typography variant="body2">Active concept</Typography>
        </Box>
      </Box>
    );
  };

  renderConceptVisualization = () => {
    const { 
      classificationResult, 
      showAllConcepts, 
      selectedConcept, 
      conceptDialogOpen, 
      conceptFilter,
      searchQuery,  // Get searchQuery from state
      isPruningMode,
      conceptsToPrune
    } = this.state;
    
    if (!classificationResult || !classificationResult.top_concepts) return null;

    // First, get the filtered concepts
    let filteredConcepts = classificationResult.top_concepts;

    // Apply search filter if there's a search query
    if (searchQuery) {
      filteredConcepts = filteredConcepts.filter(concept =>
        concept.concept.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply concept type filter
    if (conceptFilter === 'strong') {
      filteredConcepts = filteredConcepts.filter(c => c.activation >= 0.7);
    } else if (conceptFilter === 'moderate') {
      filteredConcepts = filteredConcepts.filter(c => c.activation >= 0.4 && c.activation < 0.7);
    } else if (conceptFilter === 'weak') {
      filteredConcepts = filteredConcepts.filter(c => c.activation >= 0.1 && c.activation < 0.4);
    } else if (conceptFilter === 'minimal') {
      filteredConcepts = filteredConcepts.filter(c => c.activation < 0.1);
    } else if (conceptFilter === 'biased') {
      filteredConcepts = filteredConcepts.filter(concept =>
        this.state.biasedConcepts?.some(bc => bc.concept === concept.concept)
      );
    }

    // Determine how many concepts to display
    const displayConcepts = showAllConcepts ? filteredConcepts : filteredConcepts.slice(0, 6);
    const hasMoreConcepts = filteredConcepts.length > 6;

    const maxActivation = Math.max(...classificationResult.top_concepts.map(c => c.activation));

    return (
      <Box sx={{ mt: 3 }}>
        {/* Header section with title and search */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 2,
          mb: 4
        }}>
          {/* Title and Show Top 10 button */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Typography variant="h6">
              {showAllConcepts ? 'All Concept Activations' : 'Top 10 Concept Activations'}
            </Typography>
            {showAllConcepts && (
              <Button
                variant="outlined"
                size="small"
                onClick={this.handleShowLessConcepts}
                sx={{ minWidth: 'auto' }}
              >
                Show Top 10
              </Button>
            )}
          </Box>

          {/* Search and Filter Controls */}
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2
          }}>
            {/* Search Box */}
            <TextField
              size="small"
              placeholder="Search concepts..."
              value={this.state.searchQuery}
              onChange={(e) => this.handleSearchChange(e.target.value)}
              sx={{ 
                flex: '1',
                maxWidth: '300px',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px',
                  backgroundColor: 'rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s ease',
                  border: '1px solid transparent',
                  
                  '& fieldset': {
                    borderColor: 'transparent',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.03)',
                    '& fieldset': {
                      borderColor: 'transparent',
                    }
                  },
                  '&.Mui-focused': {
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    '& fieldset': {
                      borderColor: 'primary.main',
                    }
                  }
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: '1.2rem' }} />
                  </InputAdornment>
                ),
                ...(this.state.searchQuery && {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => this.handleSearchChange('')}
                        edge="end"
                        sx={{ 
                          color: 'text.secondary',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.05)'
                          }
                        }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                })
              }}
            />

            {/* Filter Buttons */}
            <Box sx={{ 
              display: 'flex', 
              gap: 1,
              '& .MuiToggleButtonGroup-root': {
                p: 0.5,
                bgcolor: 'transparent',
                borderRadius: '20px',
                border: 'none',
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: '16px',
                  mx: 0.3,
                  px: 2,
                  py: 0.5,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  transition: 'all 0.2s ease',
                  
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                  },

                  '&.Mui-selected': {
                    color: 'white',
                    '&.all-filter': { 
                      bgcolor: '#424242',
                      '&:hover': { bgcolor: '#2d2d2d' }
                    },
                    '&.strong-filter': { 
                      bgcolor: '#2e7d32',
                      '&:hover': { bgcolor: '#1b5e20' }
                    },
                    '&.moderate-filter': { 
                      bgcolor: '#ed6c02',
                      '&:hover': { bgcolor: '#e65100' }
                    },
                    '&.weak-filter': { 
                      bgcolor: '#d32f2f',
                      '&:hover': { bgcolor: '#c62828' }
                    },
                    '&.minimal-filter': { 
                      bgcolor: '#424242',
                      '&:hover': { bgcolor: '#2d2d2d' }
                    },
                    '&.biased-filter': { 
                      bgcolor: '#9c27b0',  // Purple for bias
                      '&:hover': { bgcolor: '#7b1fa2' }
                    },
                  }
                }
              }
            }}>
              <ToggleButtonGroup
                value={conceptFilter}
                exclusive
                onChange={(e, newFilter) => newFilter && this.handleFilterChange(newFilter)}
                size="small"
              >
                <ToggleButton 
                  value="all"
                  className="all-filter"
                  sx={{ 
                    color: '#424242',
                    '&:hover': { bgcolor: 'rgba(66, 66, 66, 0.08)' }
                  }}
                >
                  All
                </ToggleButton>
                <ToggleButton 
                  value="strong" 
                  className="strong-filter"
                  sx={{ 
                    color: '#2e7d32',
                    '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.08)' }
                  }}
                >
                  Strong
                </ToggleButton>
                <ToggleButton 
                  value="moderate" 
                  className="moderate-filter"
                  sx={{ 
                    color: '#ed6c02',
                    '&:hover': { bgcolor: 'rgba(237, 108, 2, 0.08)' }
                  }}
                >
                  Moderate
                </ToggleButton>
                <ToggleButton 
                  value="weak" 
                  className="weak-filter"
                  sx={{ 
                    color: '#d32f2f',
                    '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.08)' }
                  }}
                >
                  Weak
                </ToggleButton>
                <ToggleButton 
                  value="minimal" 
                  className="minimal-filter"
                  sx={{ 
                    color: '#424242',
                    '&:hover': { bgcolor: 'rgba(66, 66, 66, 0.08)' }
                  }}
                >
                  Minimal
                </ToggleButton>
                <ToggleButton 
                  value="biased" 
                  className="biased-filter"
                  onClick={!this.state.biasedConcepts ? this.handleBiasDetection : undefined}
                  sx={{ 
                    color: '#9c27b0',
                    '&:hover': { bgcolor: 'rgba(156, 39, 176, 0.08)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <WarningIcon sx={{ fontSize: '1.1rem' }} />
                    {this.state.loadingBiasAnalysis ? 'Analyzing...' : 'Biased'}
                  </Box>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Box>
        
        {/* Cards Container */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          mt: 3 
        }}>
          <Box sx={{
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 2,
            justifyContent: 'center',
            minHeight: '300px', // Ensure minimum height for loading state
            width: '100%',
            position: 'relative' // For loading indicator positioning
          }}>
            {this.state.loadingBiasAnalysis ? (
              <Box sx={{
                position: 'absolute',
                top: '30px', // Moved higher (from 50px to 30px)
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                bgcolor: 'white',
                p: 2.5, // Reduced padding
                borderRadius: '16px', // More modern rounded corners
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)', // Softer, more modern shadow
                width: '220px', // Reduced width
                height: '180px', // Reduced height
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                border: '1px solid',
                borderColor: 'rgba(156, 39, 176, 0.1)', // Subtle purple border
              }}>
                <CircularProgress 
                  size={36} // Slightly smaller
                  sx={{ 
                    mb: 2,
                    color: '#9c27b0' // Match the bias theme color
                  }} 
                />
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#9c27b0',
                    fontSize: '1.1rem', // Slightly smaller text
                    fontWeight: 500
                  }}
                >
                  Analyzing Bias...
                </Typography>
              </Box>
            ) : (
              displayConcepts.map((concept, index) => {
                const relativeSize = (concept.activation / maxActivation) * 100;
                const colorIntensity = Math.floor((concept.activation / maxActivation) * 100);
                
                const isPruned = this.state.classificationResult?.pruned_concepts?.includes(concept.concept);
                
                return (
                  <Box
                    key={index}
                    onClick={() => {
                      if (isPruningMode) {
                        this.handleSelectConceptForPruning(concept.concept);
                      } else {
                        this.handleConceptCardClick(concept);
                      }
                    }}
                    sx={{
                      position: 'relative',
                      width: 220, // Reduced from 250px
                      minHeight: conceptFilter === 'biased' ? 260 : 200, // Reduced heights
                      bgcolor: isPruned ? 'error.light' : 'white',
                      borderRadius: 4,
                      boxShadow: isPruned ? 
                        '0 0 0 2px #f44336' : 
                        1,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': {
                        transform: 'scale(1.05)',
                        boxShadow: isPruned ?
                          '0 0 0 2px #d32f2f' :
                          `0 0 ${relativeSize}px ${colorIntensity/2}px rgba(136, 132, 216, ${concept.activation})`
                      }
                    }}
                  >
                    {/* Rank Badge - slightly smaller */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        width: 25, // Reduced from 30
                        height: 25, // Reduced from 30
                        borderRadius: '50%',
                        bgcolor: '#8884d8',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        boxShadow: 2,
                        fontSize: '0.875rem' // Smaller font size
                      }}
                    >
                      {index + 1}
                    </Box>

                    {/* Circular Progress - smaller */}
                    <Box sx={{ 
                      position: 'relative',
                      width: 100, // Reduced from 120
                      height: 100, // Reduced from 120
                      borderRadius: '50%',
                      background: `conic-gradient(
                        #8884d8 ${(concept.activation / maxActivation) * 360}deg,
                        #f0f0f0 ${(concept.activation / maxActivation) * 360}deg
                      )`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mt: 2,
                      mb: 1.5, // Reduced margin
                      mx: 'auto'
                    }}>
                      <Box sx={{
                        width: 84, // Reduced from 100
                        height: 84, // Reduced from 100
                        borderRadius: '50%',
                        bgcolor: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem', // Smaller font
                        fontWeight: 'bold',
                        color: '#8884d8'
                      }}>
                        {concept.activation.toFixed(3)}
                      </Box>
                    </Box>

                    {/* Concept Name - adjusted spacing */}
                    <Typography
                      sx={{
                        fontSize: '0.9rem', // Smaller font
                        fontWeight: 500,
                        textAlign: 'center',
                        px: 1.5, // Reduced padding
                        pb: 1.5, // Reduced padding
                        color: '#333',
                        maxHeight: '3.6em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {concept.concept}
                    </Typography>

                    {/* Bias information section - adjusted spacing */}
                    {conceptFilter === 'biased' && this.state.biasedConcepts?.find(bc => bc.concept === concept.concept) && (
                      <Box sx={{ 
                        p: 1.25, // Reduced padding
                        bgcolor: 'rgba(156, 39, 176, 0.05)', 
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'rgba(156, 39, 176, 0.2)',
                        mx: 1.5, // Reduced margin
                        mb: 1.5, // Reduced margin
                        mt: 'auto',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                          <WarningIcon sx={{ color: '#9c27b0', fontSize: '1.2rem' }} />
                          <Typography variant="subtitle2" sx={{ 
                            color: '#9c27b0',
                            fontWeight: 600
                          }}>
                            Potential Bias Detected
                          </Typography>
                        </Box>
                        {(() => {
                          const biasInfo = this.state.biasedConcepts.find(bc => bc.concept === concept.concept);
                          return (
                            <>
                              <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap',
                                gap: 1,
                                mb: 1.5
                              }}>
                                <Chip
                                  label={`Type: ${biasInfo.bias_type}`}
                                  size="small"
                                  sx={{
                                    bgcolor: 'rgba(156, 39, 176, 0.1)',
                                    color: '#9c27b0',
                                    fontWeight: 500,
                                    height: '24px'
                                  }}
                                />
                                <Chip
                                  label={`Severity: ${biasInfo.severity}`}
                                  size="small"
                                  sx={{
                                    bgcolor: biasInfo.severity === 'high' ? '#ffebee' : 
                                            biasInfo.severity === 'medium' ? '#fff3e0' : '#e8f5e9',
                                    color: biasInfo.severity === 'high' ? '#d32f2f' : 
                                           biasInfo.severity === 'medium' ? '#ed6c02' : '#2e7d32',
                                    fontWeight: 500,
                                    height: '24px'
                                  }}
                                />
                              </Box>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: 'text.secondary',
                                  fontSize: '0.8rem',
                                  lineHeight: 1.4
                                }}
                              >
                                {biasInfo.reasoning}
                              </Typography>
                            </>
                          );
                        })()}
                      </Box>
                    )}

                    {/* Add a "Pruned" indicator if the concept is pruned */}
                    {isPruned && (
                      <Chip
                        label="Pruned"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          fontSize: '0.6rem',
                          height: '18px'
                        }}
                      />
                    )}
                  </Box>
                );
              })
            )}
          </Box>

          {/* Show "Show All Concepts" button only if there are more concepts */}
          {!showAllConcepts && hasMoreConcepts && (
            <Box sx={{ 
              width: '100%', 
              display: 'flex', 
              justifyContent: 'center', 
              mt: 3 
            }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={this.handleExpandAllConcepts}
                startIcon={<KeyboardArrowDownIcon />}
                sx={{ 
                  borderRadius: 2,
                  px: 3,
                  py: 1
                }}
              >
                Show All Concepts ({filteredConcepts.length - 6} more)
              </Button>
            </Box>
          )}
        </Box>

        {/* Add the legend */}
        {this.renderPrunedLegend()}
      </Box>
    );
  };

  renderResults = () => {
    const { classificationResult, chartView } = this.state;
    const isPositive = classificationResult.final_prediction === 1;

    return (
      <>
        {/* Add prediction display */}
        <Box 
          sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: isPositive ? '#e8f5e9' : '#ffebee',
            borderRadius: 2,
            border: 1,
            borderColor: isPositive ? '#81c784' : '#ef9a9a'
          }}
        >
          <Typography 
            variant="h5" 
            align="center" 
            sx={{ color: isPositive ? '#2e7d32' : '#c62828' }}
          >
            Final Prediction: {this.getPredictionText(classificationResult.final_prediction)}
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary">
            Input Text: "{classificationResult.input_text}"
          </Typography>
        </Box>

        <Box sx={{ mb: 3 }}>
          <ToggleButtonGroup
            value={chartView}
            exclusive
            onChange={this.handleChartViewChange}
            aria-label="chart view"
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.02)',
              padding: '4px',
              borderRadius: '12px',
              border: 'none',
              gap: '4px',
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: '8px',
                px: 2,
                py: 1,
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'text.secondary',
                transition: 'all 0.2s ease',
                
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                },
                
                '&.Mui-selected': {
                  bgcolor: '#fff',
                  color: 'primary.main',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
                  '&:hover': {
                    bgcolor: '#fff',
                  }
                }
              }
            }}
          >
            <ToggleButton 
              value="bar" 
              aria-label="bar chart"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <BarChartIcon sx={{ fontSize: '1.2rem' }} />
              Bar Chart
            </ToggleButton>
            <ToggleButton 
              value="cards" 
              aria-label="concept cards"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <GridViewIcon sx={{ fontSize: '1.2rem' }} />
              Concept Cards
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {chartView === 'bar' ? 
          this.renderConceptChart() : 
          this.renderConceptVisualization()
        }

        <Box sx={{ mt: 3 }}>
          <Button
            onClick={() => this.setState(prev => ({ jsonExpanded: !prev.jsonExpanded }))}
            variant="outlined"
            sx={{ mb: 1 }}
            endIcon={this.state.jsonExpanded ? 
              <KeyboardArrowUpIcon /> : 
              <KeyboardArrowDownIcon />
            }
          >
            Full Classification Report
          </Button>
          <Collapse in={this.state.jsonExpanded}>
            <Paper 
              elevation={2}
              sx={{ 
                p: 2,
                mt: 1,
                bgcolor: '#fff',
                borderRadius: '4px',
                '& pre': {
                  margin: 0,
                  overflowX: 'auto'
                }
              }}
            >
              <pre>
                {JSON.stringify(classificationResult, null, 2)}
              </pre>
            </Paper>
          </Collapse>
        </Box>
      </>
    );
  };

  renderAccuracyComparison = () => {
    const { accuracyInfo } = this.state;
    
    if (!accuracyInfo) return null;
    
    const { originalAccuracy, prunedAccuracy, accuracyChange, prunedConcepts } = accuracyInfo;
    const isImproved = accuracyChange >= 0;
    
    return (
      <Box sx={{ 
        mt: 2, 
        p: 1.5,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1
      }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Accuracy Impact</Typography>
        
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 1
        }}>
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="body2" color="text.secondary">Original Model</Typography>
            <Typography variant="h6">{(originalAccuracy * 100).toFixed(2)}%</Typography>
          </Box>
          
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mx: 1,
            color: isImproved ? 'success.main' : 'error.main'
          }}>
            <ArrowForwardIcon sx={{ fontSize: '1.5rem' }} />
          </Box>
          
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Typography variant="body2" color="text.secondary">Pruned Model</Typography>
            <Typography variant="h6">{(prunedAccuracy * 100).toFixed(2)}%</Typography>
          </Box>
        </Box>
        
        <Box sx={{ 
          p: 0.75,
          borderRadius: 1,
          bgcolor: isImproved ? 'success.lighter' : 'error.lighter',
          color: isImproved ? 'success.darker' : 'error.darker',
          textAlign: 'center'
        }}>
          <Typography variant="body2">
            Accuracy change: {accuracyChange >= 0 ? '+' : ''}{(accuracyChange * 100).toFixed(2)}%
          </Typography>
        </Box>
        
        {/* Add information about pruned concepts */}
        {prunedConcepts && prunedConcepts.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Pruned {prunedConcepts.length} concepts:
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 0.5, 
              mt: 0.5 
            }}>
              {prunedConcepts.slice(0, 5).map(concept => (
                <Chip 
                  key={concept} 
                  label={concept} 
                  size="small" 
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {prunedConcepts.length > 5 && (
                <Chip 
                  label={`+${prunedConcepts.length - 5} more`} 
                  size="small"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  handleConceptCardClick = (conceptName) => {
    // Add console.log to help debug
    console.log("Clicked on concept:", conceptName);
    console.log("Current concepts to prune:", [...this.state.conceptsToPrune]);
    
    this.setState(prevState => {
      const newConceptsToPrune = new Set(prevState.conceptsToPrune);
      
      if (newConceptsToPrune.has(conceptName)) {
        newConceptsToPrune.delete(conceptName);
        console.log(`Removed ${conceptName} from pruning set`);
      } else {
        newConceptsToPrune.add(conceptName);
        console.log(`Added ${conceptName} to pruning set`);
      }
      
      console.log("Updated concepts to prune:", [...newConceptsToPrune]);
      return { conceptsToPrune: newConceptsToPrune };
    });
  };

  renderConceptCards = () => {
    const { classificationResult, conceptsToPrune, isPruningMode } = this.state;
    
    // Debug output
    console.log("renderConceptCards - isPruningMode:", isPruningMode);
    console.log("renderConceptCards - conceptsToPrune:", [...conceptsToPrune]);
    
    if (!classificationResult || !classificationResult.top_concepts) return null;

    return (
      <Box sx={{ mt: 3 }}>
        {/* Debug display to show what's selected */}
        {isPruningMode && (
          <Box sx={{ mb: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
            <Typography variant="subtitle2">
              Selected concepts: {conceptsToPrune.size > 0 
                ? [...conceptsToPrune].join(", ") 
                : "None"}
            </Typography>
          </Box>
        )}
        
        <Typography variant="h6" sx={{ mb: 2 }}>
          Top Concept Activations
          {isPruningMode && (
            <span style={{ color: '#ff5722', fontSize: '0.8em', marginLeft: '10px' }}>
              (Click cards to select concepts for pruning)
            </span>
          )}
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 2,
          cursor: isPruningMode ? 'pointer' : 'default'
        }}>
          {classificationResult.top_concepts.slice(0, 10).map((concept, index) => {
            const conceptName = concept.concept;
            const isSelected = conceptsToPrune.has(conceptName);
            
            // Log each concept's selection state
            console.log(`Rendering card for "${conceptName}" - isSelected: ${isSelected}`);
            
            return (
              <Paper
                key={`concept-card-${index}-${isSelected}`} // Force re-render on selection change
                elevation={3}
                onClick={() => {
                  if (isPruningMode) {
                    console.log("Clicked on concept card:", conceptName);
                    this.handleSelectConceptForPruning(conceptName);
                  }
                }}
                sx={{
                  p: 2,
                  width: 200,
                  borderRadius: 2,
                  transition: 'all 0.2s ease',
                  border: isSelected ? '2px solid #ff5722' : 'none',
                  bgcolor: isSelected ? 'rgba(255, 87, 34, 0.1)' : 'white',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: 6
                  }
                }}
              >
                <Typography variant="subtitle1" sx={{ 
                  fontWeight: 'bold',
                  color: isSelected ? '#ff5722' : 'inherit'
                }}>
                  {conceptName}
                  {isSelected && <span style={{color: 'red'}}> (selected)</span>}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Activation: <Box component="span" sx={{ fontWeight: 'bold' }}>
                    {concept.activation.toFixed(4)}
                  </Box>
                </Typography>
                {concept.contributions && concept.contributions[`class_${classificationResult.final_prediction}`] !== undefined && (
                  <Typography variant="body2" sx={{ 
                    mt: 1,
                    color: concept.contributions[`class_${classificationResult.final_prediction}`] >= 0 
                      ? '#4caf50' 
                      : '#f44336'
                  }}>
                    Contribution: <Box component="span" sx={{ fontWeight: 'bold' }}>
                      {concept.contributions[`class_${classificationResult.final_prediction}`].toFixed(4)}
                    </Box>
                  </Typography>
                )}
                {isPruningMode && isSelected && (
                  <Chip
                    label="Selected for pruning"
                    size="small"
                    color="error"
                    sx={{ mt: 1, fontSize: '0.7rem' }}
                  />
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>
    );
  };

  renderAccuracyVisualization = () => {
    const { accuracyInfo, conceptsToPrune } = this.state;
    
    if (!accuracyInfo) return null;
    
    const {
      originalAccuracy,
      prunedAccuracy,
      accuracyChange,
      prunedConcepts
    } = accuracyInfo;
    
    // Format accuracy values
    const originalPercentage = (originalAccuracy * 100).toFixed(2);
    const prunedPercentage = (prunedAccuracy * 100).toFixed(2);
    const changePercentage = (accuracyChange * 100).toFixed(2);
    const isPositiveChange = accuracyChange >= 0;
    
    return (
      <Paper sx={{ p: 3, mb: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Accuracy Impact of Pruning
        </Typography>
        
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 2
        }}>
          {/* Original Model Accuracy */}
          <Box sx={{ textAlign: 'center', width: '30%' }}>
            <Typography variant="body2" color="text.secondary">
              Original Accuracy
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>
              {originalPercentage}%
            </Typography>
          </Box>
          
          {/* Accuracy Change */}
          <Box sx={{ textAlign: 'center', width: '30%' }}>
            <Typography variant="body2" color="text.secondary">
              Change
            </Typography>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 'bold', 
                mt: 1,
                color: isPositiveChange ? 'success.main' : 'error.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isPositiveChange ? '+' : ''}{changePercentage}%
              {isPositiveChange 
                ? <ArrowUpwardIcon sx={{ ml: 0.5, fontSize: '1rem' }} />
                : <ArrowDownwardIcon sx={{ ml: 0.5, fontSize: '1rem' }} />
              }
            </Typography>
          </Box>
          
          {/* Pruned Model Accuracy */}
          <Box sx={{ textAlign: 'center', width: '30%' }}>
            <Typography variant="body2" color="text.secondary">
              Pruned Accuracy
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>
              {prunedPercentage}%
            </Typography>
          </Box>
        </Box>
        
        {/* Visualization of accuracy change */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Accuracy Impact:
          </Typography>
          <Box sx={{ position: 'relative', height: 30, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            {/* Original accuracy marker */}
            <Box 
              sx={{ 
                position: 'absolute', 
                left: `${originalPercentage}%`, 
                top: 0, 
                bottom: 0,
                width: 2,
                bgcolor: 'primary.main',
                zIndex: 2,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -6,
                  left: -4,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                }
              }}
            />
            
            {/* Pruned accuracy marker */}
            <Box 
              sx={{ 
                position: 'absolute', 
                left: `${prunedPercentage}%`, 
                top: 0, 
                bottom: 0,
                width: 2,
                bgcolor: isPositiveChange ? 'success.main' : 'error.main',
                zIndex: 2,
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: -6,
                  left: -4,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: isPositiveChange ? 'success.main' : 'error.main',
                }
              }}
            />
            
            {/* Connection line between markers */}
            <Box 
              sx={{ 
                position: 'absolute', 
                left: `${Math.min(originalPercentage, prunedPercentage)}%`, 
                width: `${Math.abs(prunedPercentage - originalPercentage)}%`,
                top: '50%',
                height: 2,
                bgcolor: isPositiveChange ? 'success.main' : 'error.main',
                opacity: 0.5
              }}
            />
          </Box>
        </Box>
        
        {/* Pruned concepts list */}
        {prunedConcepts && prunedConcepts.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Pruned Concepts:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {prunedConcepts.map(concept => (
                <Chip 
                  key={concept} 
                  label={concept} 
                  size="small" 
                  color="error" 
                  variant="outlined" 
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>
    );
  };

  renderPruningUI = () => {
    const { isPruningMode, conceptsToPrune } = this.state;
    
    return (
      <Box sx={{ 
        mb: 3, 
        p: 2, 
        bgcolor: isPruningMode ? 'rgba(255, 87, 34, 0.05)' : 'transparent',
        borderRadius: 1,
        border: isPruningMode ? '1px solid rgba(255, 87, 34, 0.3)' : 'none',
        transition: 'all 0.3s ease'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Concept Pruning
            {isPruningMode && (
              <Typography component="span" variant="body2" sx={{ ml: 1, color: 'text.secondary' }}>
                ({conceptsToPrune.size} concepts selected)
              </Typography>
            )}
          </Typography>
          <Button
            variant="contained"
            color={isPruningMode ? "error" : "primary"}
            onClick={this.handleTogglePruningMode}
            startIcon={isPruningMode ? <StopIcon /> : <ScissorsIcon />}
            size="medium"
          >
            {isPruningMode ? "Stop Pruning" : "Start Pruning"}
          </Button>
        </Box>
        
        {isPruningMode && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Click on concept cards or bars to select concepts for pruning.
              Pruning removes these concepts from the model to test their impact.
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
              {Array.from(conceptsToPrune).map(concept => (
                <Chip 
                  key={concept}
                  label={concept}
                  onDelete={() => this.handleSelectConceptForPruning(concept)}
                  color="error"
                  size="small"
                  sx={{ fontSize: '0.75rem' }}
                />
              ))}
              {conceptsToPrune.size === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No concepts selected
                </Typography>
              )}
            </Box>
            
            <Button
              variant="contained"
              color="error"
              onClick={this.handlePruneConcepts}
              disabled={conceptsToPrune.size === 0}
              sx={{ mt: 1 }}
              fullWidth
            >
              Prune Selected Concepts
            </Button>
          </>
        )}
        
        {this.state.accuracyInfo && this.renderAccuracyVisualization()}
      </Box>
    );
  };

  render() {
    const { 
      modelData, 
      error, 
      loading, 
      selectedDataset, 
      selectedModel, 
      isTraining,
      trainingStatus,
      trainingProgress,
      modelExists,
      inputText,
      classificationResult,
      classifying,
      classificationError,
      isPruningMode,
      conceptsToPrune,
      chartView,
      accuracyInfo
    } = this.state;

    console.log("Render ModelTab:", {
      modelId: this.props.modelId,
      isPruned: this.props.modelId.toString().includes('pruned'),
      accuracyInfo: accuracyInfo,
      metadata: this.props.metadata
    });

    // Check if this is a pruning in progress tab
    if (this.props.metadata && this.props.metadata.isPruningInProgress) {
      return (
        <Box sx={{ p: 3 }}>
          <Typography variant="h6">Pruning from Model: {this.props.modelId.split('_pruning_')[0]}</Typography>
          {this.renderPruningProgress()}
        </Box>
      );
    }

    // Style for disabled buttons
    const disabledButtonStyle = {
      backgroundColor: '#grey',
      color: 'darkgrey',
      '&:hover': {
        backgroundColor: '#grey',
      }
    };

    return (
      <Box sx={{ p: 3 }}>
        {/* Simplified header with just the model ID */}
        <Typography variant="h6">Model ID: {this.props.modelId}</Typography>
        
        {loading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        
        {/* If this is a pruned model and we have accuracy info, show the comparison */}
        {(this.props.modelId.toString().includes('pruned') || 
          this.props.metadata?.prunedAccuracy) && (
          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="h6">Accuracy Impact</Typography>
            {this.renderAccuracyComparison()}
            {!this.props.metadata && !accuracyInfo && (
              <Typography color="text.secondary">
                Accuracy data not available. Try evaluating the model.
              </Typography>
            )}
          </Box>
        )}
        
        <Box sx={{ 
          display: 'flex', 
          gap: 4,
          mt: 3,
          position: 'relative'
        }}>
          {/* Left Column - Controls - Back to original width */}
          <Box sx={{ 
            flex: '0 0 400px', // Back to original 400px
            maxWidth: '400px'  // Back to original 400px
          }}>
            <Typography variant="subtitle1">
              Select Dataset:
              {modelExists && <span style={{ color: 'green' }}> (Model Trained)</span>}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, my: 1, flexWrap: 'wrap' }}>
              {["SetFit/sst2", "yelp_polarity", "ag_news", "dbpedia_14"].map((dataset) => (
                <Button
                  key={dataset}
                  variant={modelData?.concept_dataset === dataset ? "contained" : "outlined"}
                  onClick={() => !modelExists && this.setState({ selectedDataset: dataset })}
                  disabled={modelExists && modelData?.concept_dataset !== dataset}
                  sx={{
                    ...(modelExists && modelData?.concept_dataset === dataset ? {
                      backgroundColor: 'grey.300',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: 'grey.300'
                      }
                    } : modelExists ? {
                      color: 'grey.500',
                      borderColor: 'grey.300'
                    } : {})
                  }}
                >
                  {dataset}
                </Button>
              ))}
            </Box>

            <Typography variant="subtitle1" sx={{ mt: 2 }}>Select Model:</Typography>
            <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
              {["gpt2", "roberta"].map((model) => (
                <Button
                  key={model}
                  variant={selectedModel === model ? "contained" : "outlined"}
                  onClick={() => !modelExists && this.setState({ selectedModel: model })}
                  disabled={modelExists}
                  sx={modelExists ? disabledButtonStyle : {}}
                >
                  {model}
                </Button>
              ))}
            </Box>

            <Button
              variant="contained"
              color="primary"
              onClick={this.handleTrainClick}
              disabled={modelExists || !selectedDataset || !selectedModel || isTraining}
              sx={{ 
                mt: 2,
                mb: 2,
                ...(modelExists && disabledButtonStyle)
              }}
            >
              {isTraining ? "Training in Progress..." : modelExists ? "Model Trained" : "Train Model"}
            </Button>

            {isTraining && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <Box sx={{ 
                  width: '100%', 
                  height: '4px', 
                  backgroundColor: '#e0e0e0',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <Box sx={{ 
                    width: `${trainingProgress}%`, 
                    height: '100%', 
                    backgroundColor: '#1976d2',
                    transition: 'width 0.5s ease-in-out'
                  }} />
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  {trainingStatus}
                </Typography>
              </Box>
            )}

            {modelExists && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6">Classify Text</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  value={inputText}
                  onChange={(e) => this.setState({ inputText: e.target.value })}
                  placeholder="Enter text to classify..."
                  sx={{ mt: 2 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={this.handleClassify}
                  disabled={!inputText || classifying}
                  sx={{ mt: 2, width: '100%' }}
                >
                  {classifying ? "Classifying..." : "Classify"}
                </Button>
              </Box>
            )}

            {classificationError && (
              <Typography color="error" sx={{ mt: 2 }}>
                {classificationError}
              </Typography>
            )}
          </Box>

          {/* Middle Column - Main Content */}
          <Box sx={{ 
            flex: 1,
            minWidth: 0,
            bgcolor: '#f8f8f8',
            borderRadius: 2,
            p: 3,
            display: classificationResult ? 'block' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 600
          }}>
            {classificationResult ? (
              this.renderResults()
            ) : (
              <Typography variant="body1">
                Classification results will appear here
              </Typography>
            )}
          </Box>

          {/* Right Column - Pruning Panel - Back to original width */}
          <Box sx={{ 
            flex: '0 0 300px', // Back to original 300px
            maxWidth: '300px', // Back to original 300px
            bgcolor: '#fff',
            borderRadius: 2,
            p: 3,
            height: 'fit-content',
            position: 'sticky',
            top: 24,
            border: 1,
            borderColor: 'divider'
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: 2 
            }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2  // Add gap between title and button
              }}>
                <Typography variant="h6" sx={{ 
                  color: isPruningMode ? 'error.main' : 'text.primary',
                  fontSize: '1.1rem',  // Slightly smaller to fit better
                  flexShrink: 0  // Prevent text from wrapping
                }}>
                  Concept Pruning
                </Typography>
                {classificationResult && chartView === 'cards' && (
                  <Button
                    variant={isPruningMode ? "contained" : "outlined"}
                    color="error"
                    startIcon={isPruningMode ? <StopIcon /> : <ScissorsIcon />}
                    onClick={this.handleTogglePruningMode}
                    sx={{ 
                      height: '36px',
                      minWidth: '120px',
                      borderRadius: '18px',
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      letterSpacing: '0.01em',
                      border: isPruningMode ? 'none' : '1.5px solid',
                      borderColor: 'error.main',
                      backgroundColor: isPruningMode ? 'error.main' : 'transparent',
                      '&:hover': {
                        backgroundColor: isPruningMode ? 'error.dark' : 'error.lighter',
                        borderColor: isPruningMode ? 'none' : 'error.dark',
                      },
                      transition: 'all 0.2s ease',
                      boxShadow: isPruningMode ? '0 2px 4px rgba(211, 47, 47, 0.2)' : 'none',
                      '& .MuiButton-startIcon': {
                        marginRight: '4px',
                        '& svg': {
                          fontSize: '1.1rem'
                        }
                      }
                    }}
                  >
                    {isPruningMode ? (
                      <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1,
                        '& .MuiChip-root': {
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          '& .MuiChip-label': {
                            px: 1,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'error.main'
                          }
                        }
                      }}>
                        <Typography sx={{ 
                          fontSize: '0.875rem',
                          fontWeight: 500
                        }}>
                          Stop
                        </Typography>
                        <Chip 
                          label={conceptsToPrune.size} 
                          size="small"
                          color="error"
                        />
                      </Box>
                    ) : (
                      <Typography sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}>
                        Start Pruning
                      </Typography>
                    )}
                  </Button>
                )}
              </Box>

              {!classificationResult ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  Classify text to start pruning concepts
                </Typography>
              ) : chartView !== 'cards' ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  Switch to Concept Cards view to prune concepts
                </Typography>
              ) : isPruningMode ? (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Click on concept cards to select them for pruning
                  </Typography>
                  {conceptsToPrune.size > 0 ? (
                    <>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        gap: 1,
                        mt: 2
                      }}>
                        {Array.from(conceptsToPrune).map((concept) => (
                          <Chip
                            key={concept}
                            label={concept}
                            onDelete={() => {
                              this.handleConceptPruneSelect(concept);
                            }}
                            color="error"
                            variant="outlined"
                            sx={{ 
                              justifyContent: 'space-between',
                              width: '100%'
                            }}
                          />
                        ))}
                      </Box>
                      <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        onClick={this.handlePruneConcepts}
                        disabled={conceptsToPrune.size === 0 || this.state.isPruning}
                        sx={{ mt: 2 }}
                      >
                        {this.state.isPruning ? (
                          <>
                            <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                            Pruning...
                          </>
                        ) : (
                          "Prune Selected Concepts"
                        )}
                      </Button>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                      No concepts selected for pruning
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  Click 'Start Pruning' to select concepts
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tabs: [1], // Start with model_id 1
      activeTab: 0,
      modelMetadata: {} // Store metadata for each model
    };
  }

  handleTabChange = (event, newValue) => {
    this.setState({ activeTab: newValue });
  };

  addNewTab = () => {
    this.setState(prevState => ({
      tabs: [...prevState.tabs, Math.max(...prevState.tabs) + 1],
      activeTab: prevState.tabs.length
    }));
  };

  addPrunedModel = (modelId, metadata = {}) => {
    this.setState(prevState => ({
      tabs: [...prevState.tabs, modelId],
      activeTab: prevState.tabs.length,
      modelMetadata: {
        ...prevState.modelMetadata,
        [modelId]: metadata
      }
    }));
  };

  updatePrunedModel = (tempId, newId, metadata = {}) => {
    this.setState(prevState => {
      const tabIndex = prevState.tabs.indexOf(tempId);
      if (tabIndex === -1) return prevState;
      
      const newTabs = [...prevState.tabs];
      newTabs[tabIndex] = newId;
      
      return {
        tabs: newTabs,
        activeTab: tabIndex,
        modelMetadata: {
          ...prevState.modelMetadata,
          [newId]: metadata
        }
      };
    });
  };

  removePrunedModel = (modelId) => {
    this.setState(prevState => {
      const tabIndex = prevState.tabs.indexOf(modelId);
      if (tabIndex === -1) return prevState;
      
      const newTabs = prevState.tabs.filter(tab => tab !== modelId);
      const newMetadata = {...prevState.modelMetadata};
      delete newMetadata[modelId];
      
      return {
        tabs: newTabs,
        activeTab: Math.min(prevState.activeTab, newTabs.length - 1),
        modelMetadata: newMetadata
      };
    });
  };

  render() {
    const { tabs, activeTab, modelMetadata } = this.state;

    return (
      <Box sx={{ width: '100%' }}>
        <AppBar position="static" color="default">
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tabs 
              value={activeTab}
              onChange={this.handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              {tabs.map((modelId, index) => (
                <Tab key={modelId} label={modelId.toString().includes('pruned') ? `Pruned ${modelId.split('_')[0]}` : `Model ${modelId}`} />
              ))}
            </Tabs>
            <Button 
              onClick={this.addNewTab}
              startIcon={<AddIcon />}
              sx={{ minWidth: 'auto', mx: 1 }}
            >
              New Model
            </Button>
          </Box>
        </AppBar>

        {tabs.map((modelId, index) => (
          <Box
            key={modelId}
            role="tabpanel"
            hidden={activeTab !== index}
          >
            {activeTab === index && (
              <ModelTab 
                modelId={modelId} 
                addPrunedModel={this.addPrunedModel}
                updatePrunedModel={this.updatePrunedModel}
                removePrunedModel={this.removePrunedModel}
                metadata={modelMetadata[modelId] || {}}
              />
            )}
          </Box>
        ))}
      </Box>
    );
  }
}

export default App;
