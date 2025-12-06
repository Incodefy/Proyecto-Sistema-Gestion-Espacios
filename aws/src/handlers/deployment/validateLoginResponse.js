/**
 * Post-Traffic Hook for Login Function Canary Deployment
 * 
 * This function validates the new version after traffic has been shifted.
 * Monitors CloudWatch metrics and validates behavior.
 */

const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');
const { CodeDeployClient, PutLifecycleEventHookExecutionStatusCommand } = require('@aws-sdk/client-codedeploy');

const cloudwatch = new CloudWatchClient({});
const codedeploy = new CodeDeployClient({});

exports.handler = async (event) => {
  console.log('Post-traffic validation started', JSON.stringify(event));

  const deploymentId = event.DeploymentId;
  const lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;

  try {
    const functionName = process.env.FUNCTION_NAME || 'inco-dev-login';

    // Monitor metrics from last 5 minutes
    const metrics = await getRecentMetrics(functionName, 5);

    console.log('Post-traffic metrics', metrics);

    // Validation criteria
    const errorRate = metrics.errors / (metrics.invocations || 1);
    const avgDuration = metrics.avgDuration;

    const validationPassed = 
      errorRate < 0.05 &&           // Error rate < 5%
      avgDuration < 5000 &&         // Avg duration < 5 seconds
      metrics.throttles === 0;      // No throttles

    if (validationPassed) {
      console.log('Post-traffic validation PASSED', {
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        avgDuration: `${avgDuration}ms`,
        throttles: metrics.throttles
      });

      await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
        deploymentId,
        lifecycleEventHookExecutionId,
        status: 'Succeeded'
      }));

      return { statusCode: 200, body: 'Validation passed' };
    } else {
      console.error('Post-traffic validation FAILED', {
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        avgDuration: `${avgDuration}ms`,
        throttles: metrics.throttles,
        criteria: {
          errorRateThreshold: '5%',
          durationThreshold: '5000ms',
          throttlesThreshold: 0
        }
      });

      await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
        deploymentId,
        lifecycleEventHookExecutionId,
        status: 'Failed'
      }));

      return { statusCode: 500, body: 'Validation failed' };
    }
  } catch (error) {
    console.error('Post-traffic hook error', error);

    await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
      deploymentId,
      lifecycleEventHookExecutionId,
      status: 'Failed'
    }));

    throw error;
  }
};

/**
 * Get CloudWatch metrics for the function
 */
async function getRecentMetrics(functionName, minutes) {
  const endTime = new Date();
  const startTime = new Date(endTime - minutes * 60 * 1000);

  const metricQueries = [
    { name: 'Invocations', metric: 'Invocations', stat: 'Sum' },
    { name: 'Errors', metric: 'Errors', stat: 'Sum' },
    { name: 'Duration', metric: 'Duration', stat: 'Average' },
    { name: 'Throttles', metric: 'Throttles', stat: 'Sum' }
  ];

  const results = {};

  for (const query of metricQueries) {
    try {
      const response = await cloudwatch.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: query.metric,
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: functionName
          }
        ],
        StartTime: startTime,
        EndTime: endTime,
        Period: minutes * 60,
        Statistics: [query.stat]
      }));

      const datapoints = response.Datapoints || [];
      results[query.name.toLowerCase()] = datapoints.length > 0
        ? datapoints[0][query.stat]
        : 0;
    } catch (error) {
      console.error(`Error fetching ${query.name}`, error);
      results[query.name.toLowerCase()] = 0;
    }
  }

  return {
    invocations: results.invocations || 0,
    errors: results.errors || 0,
    avgDuration: results.duration || 0,
    throttles: results.throttles || 0
  };
}
