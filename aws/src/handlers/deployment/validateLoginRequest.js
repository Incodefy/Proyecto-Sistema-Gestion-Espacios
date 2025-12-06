/**
 * Pre-Traffic Hook for Login Function Canary Deployment
 * 
 * This function validates the new version before shifting traffic.
 * Runs synthetic tests against the new Lambda version.
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { CodeDeployClient, PutLifecycleEventHookExecutionStatusCommand } = require('@aws-sdk/client-codedeploy');

const lambda = new LambdaClient({});
const codedeploy = new CodeDeployClient({});

exports.handler = async (event) => {
  console.log('Pre-traffic validation started', JSON.stringify(event));

  const deploymentId = event.DeploymentId;
  const lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;

  try {
    // Get new function version from event
    const newVersion = process.env.NewVersion;
    const functionName = process.env.FUNCTION_NAME || 'inco-dev-login';

    // Run synthetic tests
    const testResults = await runSyntheticTests(functionName, newVersion);

    if (testResults.passed) {
      console.log('Pre-traffic validation PASSED', testResults);

      // Signal success to CodeDeploy
      await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
        deploymentId,
        lifecycleEventHookExecutionId,
        status: 'Succeeded'
      }));

      return { statusCode: 200, body: 'Validation passed' };
    } else {
      console.error('Pre-traffic validation FAILED', testResults);

      // Signal failure to CodeDeploy (triggers rollback)
      await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
        deploymentId,
        lifecycleEventHookExecutionId,
        status: 'Failed'
      }));

      return { statusCode: 500, body: 'Validation failed' };
    }
  } catch (error) {
    console.error('Pre-traffic hook error', error);

    // Signal failure on exception
    await codedeploy.send(new PutLifecycleEventHookExecutionStatusCommand({
      deploymentId,
      lifecycleEventHookExecutionId,
      status: 'Failed'
    }));

    throw error;
  }
};

/**
 * Run synthetic tests against new Lambda version
 */
async function runSyntheticTests(functionName, version) {
  const tests = [
    {
      name: 'Health Check',
      payload: { httpMethod: 'GET', path: '/health' }
    },
    {
      name: 'Invalid Credentials',
      payload: {
        httpMethod: 'POST',
        path: '/auth/login',
        body: JSON.stringify({ username: 'test@test.com', password: 'wrong' })
      }
    },
    {
      name: 'Missing Parameters',
      payload: {
        httpMethod: 'POST',
        path: '/auth/login',
        body: JSON.stringify({})
      }
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const response = await lambda.send(new InvokeCommand({
        FunctionName: `${functionName}:${version}`,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(test.payload)
      }));

      const payload = JSON.parse(Buffer.from(response.Payload).toString());
      
      results.push({
        test: test.name,
        passed: response.StatusCode === 200 && !payload.errorMessage,
        statusCode: response.StatusCode,
        payload: payload
      });
    } catch (error) {
      results.push({
        test: test.name,
        passed: false,
        error: error.message
      });
    }
  }

  const allPassed = results.every(r => r.passed);

  return {
    passed: allPassed,
    results,
    timestamp: new Date().toISOString()
  };
}
