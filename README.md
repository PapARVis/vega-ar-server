# PapARVis Designer: SpecHub
**SpecHub** is deployed on a cloud server to receive and host the specifications from VegaAR Editor (*i.e.*, like a piece of code hosted on Github). Besides, it prepares all prerequisites for the AR visualization, such as processing the specification of static visualization (V<sub>s</sub>) to generate the AR reference image so that V<sub>s</sub> can be recognized by AR viewers, parsing the ar block to render the virtual visualization (V<sub>v</sub>) with the new data whenever a user views it using an AR viewer.

## Install
1. Install the nodejs packages: ```npm install```
2. Install [PM2](https://pm2.keymetrics.io/) (a process manager): ```npm install pm2 -g```

## Configuration
### Set up Vuforia
To dynamically upload the images to Vuforia, we need to use Cloud Recognition Service that requires a pair of keys.

In ```src/config.ts```, please input the Vuforia keys to ```VUFORIA```.

### Set up addresses for connections with VegaAR Editor and AR Viewer
To connect between different units, we need to set up the addresses for both VegaAR Editor and AR Viewer.

In ```src/config.ts```, please modify the ```PORTS``` and ```DOMAIN``` to your ports and domain which matching the address set in both VegaAR Editor and AR Viewer.

## How to run
1. Build the code: ```npm run build```
2. Run the backend server: ```npm run start:pm2```
