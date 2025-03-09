const showProgress = props.isPruning || props.isEvaluating;

return (
  <Collapse in={showProgress}>
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6">
        {props.isPruning ? "Pruning in Progress..." : "Evaluating Pruned Model..."}
      </Typography>
      <LinearProgress sx={{ mt: 2, mb: 1 }} />
      <Typography variant="body2" color="text.secondary">
        {props.isPruning 
          ? "Pruning concepts from the model. This may take a few minutes." 
          : "Evaluating the pruned model performance. This may take a few minutes."}
      </Typography>
    </Paper>
  </Collapse>
); 