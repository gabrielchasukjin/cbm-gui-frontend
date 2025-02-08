import React, { Component } from 'react';
import axios from 'axios';
import { 
  Box, 
  Tabs, 
  Tab, 
  Button, 
  Typography,
  TextField,
  AppBar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import './App.css';

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
      modelExists: false
    };
  }

  componentDidMount() {
    this.fetchModelData();
  }

  fetchModelData = async () => {
    try {
      this.setState({ loading: true });
      const response = await axios.get(`http://127.0.0.1:5050/process-model/?model_id=${this.props.modelId}`);
      
      // Check if model exists by checking if response.data is not null AND has properties
      const modelExists = response.data !== null && Object.keys(response.data).length > 0;
      console.log('Model data received:', response.data); // Debug log
      console.log('Model exists:', modelExists); // Debug log
      
      this.setState({ 
        modelData: response.data,
        loading: false,
        modelExists,
        // Only set selected options if model actually exists
        ...(modelExists && {
          selectedDataset: response.data.concept_dataset || "",
          selectedModel: response.data.backbone || ""
        })
      });
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
      modelExists 
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
        <Typography variant="h6">Model ID: {this.props.modelId}</Typography>
        
        {loading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">{error}</Typography>}
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1">
            Select Dataset:
            {modelExists && <span style={{ color: 'green' }}> (Model Trained)</span>}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
            {["SST2", "yelp_polarity", "ag_news", "dbpedia_14"].map((dataset) => (
              <Button
                key={dataset}
                variant={selectedDataset === dataset ? "contained" : "outlined"}
                onClick={() => !modelExists && this.setState({ selectedDataset: dataset })}
                disabled={modelExists}
                sx={modelExists ? disabledButtonStyle : {}}
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

          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={this.handleTrainClick}
              disabled={modelExists || !selectedDataset || !selectedModel || isTraining}
              sx={{ 
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
                <Typography 
                  variant="body2" 
                  color="textSecondary" 
                  sx={{ mt: 1 }}
                >
                  {trainingStatus}
                </Typography>
              </Box>
            )}

            {error && (
              <Typography color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
          </Box>
        </Box>

        {modelData && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6">Model Data:</Typography>
            <pre>{JSON.stringify(modelData, null, 2)}</pre>
          </Box>
        )}
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
