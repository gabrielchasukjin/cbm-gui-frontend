renderAccuracyComparison = () => {
  // Try getting accuracy data from either metadata prop or state
  const metadata = this.props.metadata || this.state.accuracyInfo;
  
  if (!metadata) {
    console.log("No accuracy data available");
    return null;
  }
  
  const { originalAccuracy, prunedAccuracy, accuracyChange, prunedConcepts } = metadata;
  
  // Only render if we have accuracy data
  if (!originalAccuracy || !prunedAccuracy) {
    console.log("Missing accuracy data", { originalAccuracy, prunedAccuracy });
    return null;
  }
  
  // Format values for display
  const originalPercentage = (originalAccuracy * 100).toFixed(2);
  const prunedPercentage = (prunedAccuracy * 100).toFixed(2);
  const changePercentage = (accuracyChange * 100).toFixed(2);
  const isPositiveChange = accuracyChange >= 0;
  
  // Render the comparison UI
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      {/* Your existing comparison UI */}
    </Paper>
  );
}; 