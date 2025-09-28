# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### mihome-vacuum Adapter Specific Context

This adapter enables control of Xiaomi/Roborock vacuum cleaners through ioBroker. Key features include:

- **Supported Devices**: Xiaomi Mi Robot, Roborock S5/S6/S7/S8, Dreame vacuum cleaners, and Valetudo-flashed devices
- **Core Functionality**: 
  - Robot control (start/stop/pause/dock)
  - Real-time status monitoring
  - Zone and room-based cleaning
  - Map generation and visualization
  - Consumables tracking (brushes, filters, mop)
  - Scheduling and timers
  - Multi-robot support

- **Technical Architecture**:
  - Uses miIO protocol for Xiaomi devices
  - Supports both cloud and local connections
  - Canvas-based map generation with visualization
  - Multiple device managers (VacuumManager, RoborockManager, DreameManager)
  - Encrypted token storage for security

- **External Dependencies**:
  - Optional canvas package for map generation
  - Network connectivity to vacuum devices
  - Xiaomi cloud API for device discovery
  - Various vacuum-specific communication protocols

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
                        
                        // Verify that basic states exist
                        const states = await harness.states.getKeysAsync('your-adapter.0.*');
                        console.log(`Found ${states.length} states created by adapter`);
                        
                        if (states.length === 0) {
                            throw new Error('No states were created by the adapter');
                        }

                        resolve();
                    } catch (error) {
                        console.error('Integration test failed:', error);
                        reject(error);
                    }
                });
            }).timeout(60000); // Generous timeout for integration tests
        });
    }
});
```

#### Testing Adapter-Specific Functionality

For mihome-vacuum adapter testing:
- Mock vacuum device responses for offline testing
- Test map generation functionality with sample data
- Validate device manager selection logic
- Test encryption/decryption of tokens
- Verify multi-device support scenarios

### Advanced Testing Patterns

#### Mocking Hardware/Network Dependencies
```javascript
// Mock miIO protocol responses for testing
const mockMiio = {
    sendMessage: (command) => {
        if (command === 'miIO.info') {
            return Promise.resolve({
                result: {
                    model: 'roborock.vacuum.s5',
                    fw_ver: '1.0.0',
                    hw_ver: 'MW300'
                }
            });
        }
        return Promise.resolve({ result: 'ok' });
    }
};

// Test map generation with sample data
const sampleMapData = {
    image: {
        dimensions: { width: 1024, height: 1024 },
        position: { top: 0, left: 0 },
        pixels: Buffer.alloc(1024 * 1024 * 4) // RGBA buffer
    },
    path: {
        points: [[100, 100], [200, 200], [300, 300]]
    },
    charger: { position: [512, 512] }
};
```

## Adapter Architecture

### Core Components

#### Device Managers
- **VacuumManager**: Base functionality for Xiaomi Mi Robot
- **RoborockManager**: Extended features for Roborock devices  
- **DreameManager**: Dreame vacuum-specific implementation
- Each manager handles device-specific protocols and features

#### Map Generation (lib/mapCreator.js)
- Canvas-based rendering of vacuum maps
- Configurable colors and robot icons
- Path visualization and zone highlighting
- Optional dependency - graceful fallback when canvas unavailable

#### Communication Protocols
- **miIO Protocol**: Direct device communication
- **Cloud API**: Xiaomi cloud service integration
- **Valetudo**: Local-only firmware support

### Configuration Management
- Encrypted storage of sensitive data (tokens, passwords)
- Multi-device configuration support
- Server region selection for cloud connectivity

## Error Handling

### Adapter-Specific Error Scenarios
- Device offline/unreachable
- Invalid tokens or authentication failures
- Map generation failures (missing canvas)
- Protocol version mismatches
- Network connectivity issues

### Error Response Patterns
```javascript
// Graceful degradation for optional features
try {
    const mapImage = await generateMap(mapData);
    await this.setStateAsync('map.image', mapImage);
} catch (error) {
    this.log.warn('Map generation failed, canvas not available: ' + error.message);
    // Continue without map functionality
}

// Retry logic for network operations
async function callWithRetry(operation, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

## Device Protocol Integration

### miIO Protocol Implementation
- Token-based authentication
- Command/response pattern
- Device capability detection
- Status polling and event handling

### Multi-Device Architecture
```javascript
// Device manager factory pattern
getManager(model, configuredManager) {
    const managers = {
        'roborock.vacuum.s5': RoborockManager,
        'roborock.vacuum.s6': RoborockManager,
        'dreame.vacuum.mc1808': DreameManager,
        // ... more device mappings
    };
    
    return configuredManager || managers[model] || VacuumManager;
}
```

### State Management
- Real-time status updates
- Battery and consumables monitoring  
- Cleaning history and statistics
- Error code translation and reporting

## Performance Considerations

### Network Optimization
- Configurable polling intervals
- Connection pooling for multiple devices
- Graceful handling of network timeouts

### Resource Management
```javascript
// Proper cleanup in unload method
async onUnload(callback) {
    try {
        // Clear timers
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = undefined;
        }
        
        // Close device connections
        if (this.miio) {
            await this.miio.destroy();
        }
        
        callback();
    } catch (e) {
        callback();
    }
}
```

## Security Best Practices

### Token and Password Handling
- Use ioBroker's built-in encryption for sensitive data
- Never log tokens or passwords in plain text
- Implement secure token refresh mechanisms

### Network Security
- Support for local-only operation (Valetudo)
- Validate all external API responses
- Implement rate limiting for API calls

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

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

## Adapter-Specific Development Guidelines

### Map Generation Best Practices
- Always check for canvas availability before attempting map operations
- Provide fallback functionality when canvas is not available
- Use efficient rendering techniques for large map data
- Implement proper error handling for corrupted map data

### Device Communication Patterns
```javascript
// Robust device communication with retry logic
async function sendDeviceCommand(command, params = []) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await this.miio.sendMessage(command, params);
            return result;
        } catch (error) {
            lastError = error;
            this.log.debug(`Command ${command} attempt ${attempt} failed: ${error.message}`);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    throw lastError;
}
```

### Configuration Validation
```javascript
// Validate configuration before adapter startup
function validateConfig(config) {
    const errors = [];
    
    if (!config.token && !config.email) {
        errors.push('Either token or email/password must be provided');
    }
    
    if (config.pingInterval < 10000) {
        errors.push('Ping interval must be at least 10 seconds');
    }
    
    if (errors.length > 0) {
        throw new Error('Configuration validation failed: ' + errors.join(', '));
    }
}
```