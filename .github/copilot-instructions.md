# ioBroker mihome-vacuum Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

**Adapter-Specific Context**: This adapter provides integration with Xiaomi/Roborock vacuum cleaners and similar devices (Viomi, Dreame). It connects to vacuum cleaners via local network communication or cloud API to provide comprehensive control, monitoring, and automation capabilities. The adapter supports:

- Multiple vacuum brands: Xiaomi Mi Robot, Roborock series (S5, S6, S7, S8, etc.), Viomi, Dreame
- Local network communication via miIO protocol and cloud-based communication via Xiaomi Cloud API
- Map integration including Valetudo support for rooted devices
- Zone cleaning, room-based cleaning, and scheduled cleaning
- Real-time status monitoring, consumables tracking, and maintenance alerts
- Integration with smart home systems like Alexa for voice control

Key technical components:
- `lib/miio`: Local miIO protocol communication
- `lib/XiaomiCloudConnector`: Cloud API integration
- `lib/vacuum`, `lib/viomi`, `lib/dreame`: Device-specific managers
- Map rendering and zone management via canvas (optional dependency)
- Valetudo integration for custom firmware devices

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Verify key states exist
                        const states = await harness.states.getStatesAsync('your-adapter.0.*');
                        
                        console.log(`📊 Found ${Object.keys(states).length} states`);
                        
                        if (Object.keys(states).length === 0) {
                            return reject(new Error('No states found - adapter may not have processed data correctly'));
                        }

                        console.log('✅ Integration test passed - adapter created states successfully');
                        resolve();
                        
                    } catch (error) {
                        console.error('❌ Integration test failed:', error.message);
                        reject(error);
                    }
                });
            }).timeout(60000);
        });
    }
});
```

#### Testing Best Practices for ioBroker

1. **Always use defineAdditionalTests**: Standard pattern for custom integration tests
2. **Harness management**: Get fresh harness instance, configure before starting
3. **Async/await patterns**: Wrap callbacks in promises for better control
4. **Proper timeouts**: Set reasonable timeouts (30-60s for integration tests)
5. **State verification**: Check that expected states are created and have reasonable values
6. **Error handling**: Wrap in try/catch and provide meaningful error messages

#### Test File Organization
- `test/integration.js`: Standard integration tests using `@iobroker/testing`
- `test/unit.js`: Unit tests for individual functions
- `test/package.js`: Package validation tests

#### Mock Data for Testing
For vacuum adapter testing, create mock responses for:
- Device discovery responses
- Status polling responses  
- Command execution responses
- Map data (for map-enabled features)
- Cloud API authentication flows

Example mock structure:
```javascript
const mockVacuumStatus = {
    state: 8, // cleaning
    battery: 85,
    clean_time: 1500,
    clean_area: 25.5,
    error_code: 0,
    map_present: 1,
    in_cleaning: 1
};

const mockDeviceInfo = {
    model: 'roborock.vacuum.s5',
    fw_ver: '1.2.3',
    serial_number: 'TEST123456'
};
```

## Error Handling

### Adapter-Specific Error Handling
The mihome-vacuum adapter should implement robust error handling for:

1. **Network Connectivity Issues**:
   ```javascript
   try {
       await device.send('get_status');
   } catch (error) {
       if (error.code === 'ETIMEDOUT') {
           this.log.warn('Device communication timeout - device may be offline');
           await this.setState('info.connection', false, true);
       } else {
           throw error;
       }
   }
   ```

2. **Cloud Authentication Failures**:
   ```javascript
   try {
       await xiaomiCloud.login(username, password);
   } catch (error) {
       if (error.message.includes('Invalid credentials')) {
           this.log.error('Cloud login failed - check username and password in adapter settings');
           return;
       }
       throw error;
   }
   ```

3. **Device Command Failures**:
   ```javascript
   async executeCommand(command, params) {
       try {
           const result = await this.device.send(command, params);
           return result;
       } catch (error) {
           this.log.warn(`Command ${command} failed: ${error.message}`);
           // Don't throw - vacuum might be busy, offline, etc.
           return { error: error.message };
       }
   }
   ```

4. **Map Processing Errors**:
   ```javascript
   try {
       const mapData = await this.getMap();
       await this.processMap(mapData);
   } catch (error) {
       this.log.warn('Map processing failed, continuing without map features');
       // Adapter should continue functioning without map features
   }
   ```

### Standard ioBroker Error Patterns
Follow ioBroker conventions:
- Use `this.log.error()` for critical errors that prevent adapter function
- Use `this.log.warn()` for recoverable issues
- Use `this.log.info()` for important status changes
- Use `this.log.debug()` for detailed troubleshooting info

## Resource Management and Cleanup

### Connection Management
```javascript
async onUnload(callback) {
  try {
    // Clear all timers
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    // Close connections, clean up resources
    if (this.device) {
      await this.device.destroy();
      this.device = null;
    }
    if (this.xiaomiCloud) {
      this.xiaomiCloud = null;
    }
    callback();
  } catch (e) {
    callback();
  }
}
```

### Memory Management for Map Data
```javascript
// Large map data should be processed and disposed properly
async processMapData(mapBuffer) {
    try {
        const map = await this.parseMap(mapBuffer);
        await this.updateMapStates(map);
        // Clear large buffers after processing
        mapBuffer = null;
        map.raw = null;
    } catch (error) {
        this.log.error(`Map processing failed: ${error.message}`);
    }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

### Adapter-Specific Coding Standards
- Encrypt sensitive data (tokens, passwords) using ioBroker's encryption methods
- Use consistent state naming conventions: `vacuum.state`, `vacuum.battery`, `consumables.main_brush`
- Implement proper device discovery and selection in admin interface
- Handle multiple robot support gracefully
- Provide clear error messages for common setup issues (wrong IP, invalid token, etc.)

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

### Adapter-Specific Testing Considerations

For the mihome-vacuum adapter, consider these testing scenarios:

1. **Device Discovery Testing**: Mock local network discovery
2. **Cloud Authentication**: Test with invalid/valid credentials
3. **Command Execution**: Mock device responses for all supported commands
4. **Map Processing**: Test map parsing with various map formats
5. **Multi-Robot Support**: Test configuration and state management for multiple robots
6. **Valetudo Integration**: Test custom firmware device communication

Example test structure for vacuum-specific features:
```javascript
suite('Vacuum-Specific Features', (getHarness) => {
    it('should handle device discovery', async () => {
        // Test local device discovery
    });
    
    it('should process vacuum status correctly', async () => {
        // Test status parsing and state updates
    });
    
    it('should handle map data processing', async () => {
        // Test map parsing and rendering
    });
    
    it('should support multiple robot configuration', async () => {
        // Test multi-robot setup
    });
});
```

## Development Workflow

### Branch Strategy
- Use feature branches for new functionality
- Test thoroughly before merging to main branch
- Use semantic versioning for releases

### Debugging Tips
- Enable debug logging: `this.log.debug()`
- Use network packet capture for miIO protocol debugging
- Test with physical devices when possible
- Use Valetudo test environments for development

### Documentation
- Keep README files up to date with supported devices
- Document configuration parameters clearly
- Provide troubleshooting guides for common issues
- Include examples for complex features (zone cleaning, scripting)