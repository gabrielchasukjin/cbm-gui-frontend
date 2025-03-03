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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  LinearProgress,
  Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import './App.css';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';
import * as d3 from 'd3';

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
        classificationResult: response.data,
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

  renderConceptChart = () => {
    const { classificationResult } = this.state;
    if (!classificationResult || !classificationResult.top_concepts) return null;

    // Get top 10 concepts and prepare data for the chart
    const chartData = classificationResult.top_concepts
      .slice(0, 10)
      .map(item => ({
        concept: item.concept,
        activation: parseFloat(item.activation.toFixed(3))
      }));

    return (
      <Box sx={{ mt: 3, height: 400 }}>
        <Typography variant="h6">Top 10 Concept Activations</Typography>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              top: 20,
              right: 30,
              left: 250, // Increased left margin for concept names
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 'auto']} />
            <YAxis 
              type="category" 
              dataKey="concept" 
              width={240} 
              tick={{ fontSize: 12 }}
            />
            <Tooltip />
            <Bar 
              dataKey="activation" 
              fill="#8884d8" 
              name="Activation Score"
            />
          </BarChart>
        </ResponsiveContainer>
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

  renderConceptVisualization = () => {
    const { classificationResult, showAllConcepts, selectedConcept, conceptDialogOpen, conceptFilter } = this.state;
    if (!classificationResult || !classificationResult.top_concepts) return null;

    // Filter concepts based on their strength
    const filterConcepts = (concepts) => {
      if (conceptFilter === 'all') return concepts;
      
      return concepts.filter(concept => {
        const relativeStrength = concept.activation / Math.max(...concepts.map(c => c.activation));
        if (conceptFilter === 'strong' && relativeStrength > 0.8) return true;
        if (conceptFilter === 'moderate' && relativeStrength > 0.5 && relativeStrength <= 0.8) return true;
        if (conceptFilter === 'weak' && relativeStrength > 0.2 && relativeStrength <= 0.5) return true;
        if (conceptFilter === 'minimal' && relativeStrength <= 0.2) return true;
        return false;
      });
    };

    const filteredConcepts = filterConcepts(classificationResult.top_concepts);
    const displayConcepts = showAllConcepts 
      ? filteredConcepts 
      : filteredConcepts.slice(0, 10);
    
    const maxActivation = Math.max(...classificationResult.top_concepts.map(c => c.activation));
    const hasMoreConcepts = filteredConcepts.length > 10;

    return (
      <Box sx={{ mt: 3 }}>
        {/* Header with filter and show/hide buttons */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 4  // Increased from mb: 2 to mb: 4 for more spacing
        }}>
          <Typography variant="h6">
            {showAllConcepts ? 'All Concept Activations' : 'Top 10 Concept Activations'}
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            gap: 1,
            '& .MuiToggleButtonGroup-root': {  // Add some padding to the button group
              p: 0.5,
              bgcolor: '#f5f5f5',
              borderRadius: 1
            }
          }}>
            <ToggleButtonGroup
              value={conceptFilter}
              exclusive
              onChange={(e, newFilter) => newFilter && this.handleFilterChange(newFilter)}
              size="small"
            >
              <ToggleButton value="all">
                All
              </ToggleButton>
              <ToggleButton value="strong" sx={{ color: '#2e7d32' }}>
                Strong
              </ToggleButton>
              <ToggleButton value="moderate" sx={{ color: '#ffd700' }}>
                Moderate
              </ToggleButton>
              <ToggleButton value="weak" sx={{ color: '#ffa726' }}>
                Weak
              </ToggleButton>
              <ToggleButton value="minimal" sx={{ color: '#ffb74d' }}>
                Minimal
              </ToggleButton>
            </ToggleButtonGroup>
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
        </Box>
        
        {/* Concept Cards Layout */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          mt: 2 
        }}>
          {/* Cards Container */}
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 2,
            justifyContent: 'center',
          }}>
            {displayConcepts.map((concept, index) => {
              const relativeSize = (concept.activation / maxActivation) * 100;
              const colorIntensity = Math.floor((concept.activation / maxActivation) * 100);
              
              return (
                <Box
                  key={index}
                  onClick={() => this.handleConceptCardClick(concept)}
                  sx={{
                    position: 'relative',
                    width: 200,
                    height: 220,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    bgcolor: 'white',
                    borderRadius: 4,
                    boxShadow: 1,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: `0 0 ${relativeSize}px ${colorIntensity/2}px rgba(136, 132, 216, ${concept.activation})`,
                    }
                  }}
                >
                  {/* Circular Progress */}
                  <Box sx={{
                    position: 'relative',
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: `conic-gradient(
                      #8884d8 ${(concept.activation / maxActivation) * 360}deg,
                      #f0f0f0 ${(concept.activation / maxActivation) * 360}deg
                    )`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mt: 2, // Added margin top
                    mb: 2
                  }}>
                    <Box sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      bgcolor: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#8884d8'
                    }}>
                      {concept.activation.toFixed(3)}
                    </Box>
                  </Box>

                  {/* Concept Name */}
                  <Typography
                    sx={{
                      fontSize: '1rem',
                      fontWeight: 500,
                      textAlign: 'center',
                      px: 2,
                      pb: 2, // Added padding bottom
                      color: '#333',
                      maxHeight: '3.6em', // Increased max height
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3, // Increased to 3 lines
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {concept.concept}
                  </Typography>

                  {/* Rank Badge */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -10,
                      left: -10,
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      bgcolor: '#8884d8',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      boxShadow: 2
                    }}
                  >
                    {index + 1}
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Expand All Button */}
          {!showAllConcepts && hasMoreConcepts && (
            <Button
              variant="outlined"
              color="primary"
              onClick={this.handleExpandAllConcepts}
              sx={{ mt: 2, mb: 2 }}
            >
              Show All Concepts ({filteredConcepts.length})
            </Button>
          )}
        </Box>

        {/* Concept Detail Dialog */}
        <Dialog
          open={conceptDialogOpen}
          onClose={this.handleDialogClose}
          maxWidth="md"
          fullWidth
        >
          {selectedConcept && (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">
                    Concept Details
                  </Typography>
                  <Chip 
                    label={`Activation: ${selectedConcept.activation.toFixed(3)}`}
                    color="primary"
                  />
                </Box>
              </DialogTitle>
              <DialogContent>
                <Box sx={{ py: 2 }}>
                  {/* Concept Name */}
                  <Typography variant="h5" sx={{ mb: 2 }}>
                    {selectedConcept.concept}
                  </Typography>

                  {/* Input Text */}
                  <Paper sx={{ p: 2, mt: 1, mb: 3, bgcolor: '#f5f5f5' }}>
                    <Typography variant="body2" component="div" sx={{ fontStyle: 'italic' }}>
                      "{classificationResult.input_text}"
                    </Typography>
                  </Paper>

                  {/* Relative Strength */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" color="primary" sx={{ mb: 1 }}>
                      Relative Strength
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={(selectedConcept.activation / maxActivation) * 100}
                      sx={{ height: 10, borderRadius: 5 }}
                    />
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      {`${((selectedConcept.activation / maxActivation) * 100).toFixed(1)}% of maximum activation`}
                    </Typography>
                  </Box>

                  {/* Concept Impact */}
                  <Box>
                    <Typography variant="subtitle1" color="primary" sx={{ mb: 1 }}>
                      Impact on Classification
                    </Typography>
                    {(() => {
                      const impact = this.getConceptImpactDescription(
                        selectedConcept.activation,
                        maxActivation,
                        classificationResult.final_prediction
                      );
                      return (
                        <Typography sx={{ color: 'text.primary' }}>
                          {impact.strengthWord && (
                            <Box component="span" sx={{ 
                              color: impact.color,
                              fontWeight: 'bold'
                            }}>
                              {impact.strengthWord}
                            </Box>
                          )}{' '}
                          {impact.text}
                        </Typography>
                      );
                    })()}
                  </Box>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={this.handleDialogClose}>Close</Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    );
  };

  renderResults = () => {
    const { classificationResult, chartView } = this.state;
    const isPositive = classificationResult.final_prediction === 1; // Changed condition

    return (
      <>
        {/* Add prediction display */}
        <Box 
          sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: isPositive ? '#e8f5e9' : '#ffebee', // Now green for positive (1), red for negative (0)
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
          >
            <ToggleButton value="bar" aria-label="bar chart">
              Bar Chart
            </ToggleButton>
            <ToggleButton value="cards" aria-label="concept cards">
              Concept Cards
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {chartView === 'bar' ? 
          this.renderConceptChart() : 
          this.renderConceptVisualization()
        }

        <Typography variant="h6" sx={{ mt: 3 }}>Full Classification Result:</Typography>
        <pre style={{ 
          backgroundColor: '#fff',
          padding: '1rem',
          borderRadius: '4px',
          overflowX: 'auto'
        }}>
          {JSON.stringify(classificationResult, null, 2)}
        </pre>
      </>
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
      classificationError
    } = this.state;

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Model ID: {this.props.modelId}</Typography>
          {modelExists && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={this.handleDownload}
              sx={{ ml: 2 }}
            >
              Download Model
            </Button>
          )}
        </Box>
        
        {loading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        
        <Box sx={{ 
          display: 'flex', 
          gap: 4,
          mt: 3 
        }}>
          {/* Left Column - Controls */}
          <Box sx={{ 
            flex: '0 0 400px',
            maxWidth: '400px'
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

          {/* Right Column - Results */}
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
              <Typography variant="body1" color="text.secondary">
                Classification results will appear here
              </Typography>
            )}
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
      activeTab: 0
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

  render() {
    const { tabs, activeTab } = this.state;

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
                <Tab key={modelId} label={`Model ${modelId}`} />
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
              <ModelTab modelId={modelId} />
            )}
          </Box>
        ))}
      </Box>
    );
  }
}

export default App;
