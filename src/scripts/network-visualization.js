// network-visualization.js

import { updateLossChart } from "./charts/loss-chart.js";
import { stopTraining } from './event-handlers.js';
import { getNodeData, handleNeuronMouseover, handleNeuronMouseleave, createNeuronPopup, updateNeuronPopup, hideNeuronPopup } from './neuron/neuron-info.js';
import { InputNode, HiddenNode, OutputNode } from './neuron/node.js';

// === Color Definitions ===
const COLOR_SCALE_INTERPOLATOR = d3.interpolateViridis; // Color scale interpolator for activations
const COLOR_SCALE_DOMAIN_DEFAULT = [0, 1]; // Default domain for color scale

const LINK_HOVER_STROKE = "rgba(255, 0, 85, 1)"; // Highlight color for links on hover
const LINK_HOVER_FILTER = "drop-shadow(0 0 10px rgba(255, 0, 85, 1))"; // Drop shadow for hovered links
const TOOLTIP_TEXT_COLOR = "white"; // Text color for tooltips
const TOOLTIP_FONT_SIZE = "14px"; // Font size for tooltips
const TOOLTIP_TEXT_ANCHOR = "middle"; // Text anchor for tooltips

const LIGHT_FILL_COLOR = "rgba(255, 255, 255, 0.9)"; // Fill color for animated lights
const LIGHT_STROKE_COLOR = "rgba(200, 200, 200, 0.7)"; // Stroke color for animated lights
const LIGHT_STROKE_WIDTH = 6; // Stroke width for animated lights

const LINK_DEFAULT_STROKE_WIDTH = 1; // Default stroke width for links
const LINK_HOVER_STROKE_WIDTH = 2; // Stroke width for links on hover

// ============================

const colorScale = d3.scaleSequential()
    .interpolator(COLOR_SCALE_INTERPOLATOR) // Choose a color scheme
    .domain(COLOR_SCALE_DOMAIN_DEFAULT); // Normalize based on activation range

let nodes = [];
let links = [];
let popup;
let isOverNode = false;
let isOverPopup = false;
let hidePopupTimeout;
let selectedNodeIndex = 0;
let currentHoveredNode = null;

/**
 * Generates a random color that is a mix of red and blue.
 * Ensures both red and blue components are above a certain threshold for visibility.
 * @returns {string} - The generated RGBA color string.
 */
function getRandomRedBlueColor() {
    const red = Math.floor(100 + Math.random() * 156); // 100-255
    const blue = Math.floor(100 + Math.random() * 156); // 100-255
    const green = 0; // Keep green at 0 for a pure red-blue mix
    return `rgba(${red}, ${green}, ${blue}, 1)`;
}

export function drawNeuralNetwork(layers, weights, data) {
    d3.select("#visualization").html("");

    // Get the dimensions of the #visualization container
    const visualizationDiv = document.getElementById('visualization');
    const svgWidth = visualizationDiv.clientWidth;
    const svgHeight = visualizationDiv.clientHeight;

    const svg = d3.select("#visualization").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet"); // Ensures the SVG scales properly

    const lightsGroup = svg.append("g").attr("class", "lights-group");
    const popupGroup = svg.append("g").attr("class", "popup-group");

    const forwardData = data?.forward_data;
    const layerSpacing = svgWidth / (layers.length + 1);
    const nodeRadius = 20;

    popup = createNeuronPopup(popupGroup);
    setupPopupHover(popup);

    nodes = layers.flatMap((layerSize, layerIndex) => 
        createLayerNodes(layerSize, layerIndex, layerSpacing, nodeRadius, svg, popup, popupGroup, forwardData, data, layers)
    );

    nodes.forEach(sourceNode => {
        if (sourceNode.layerIndex < layers.length - 1) {
            createLayerLinks(sourceNode, nodes, layers, lightsGroup, weights);
        }
    });

    // Handle window resize to make SVG responsive
    window.addEventListener('resize', () => {
        const newWidth = visualizationDiv.clientWidth;
        const newHeight = visualizationDiv.clientHeight;
        svg.attr("width", newWidth).attr("height", newHeight)
           .attr("viewBox", `0 0 ${newWidth} ${newHeight}`);
        
        // Optionally, you can redraw the network or adjust node positions here
    });
}

function createLayerNodes(layerSize, layerIndex, layerSpacing, nodeRadius, svg, popup, popupGroup, forwardData, data, layers) {
    const ySpacing = svg.attr("height") / (layerSize + 1);
    const x = layerSpacing * (layerIndex + 1);

    return Array.from({ length: layerSize }, (_, i) => {
        const y = ySpacing * (i + 1);
        let node = createNode(layerIndex, i, x, y, nodeRadius, svg, popup, popupGroup, layers);
        const nodeData = getNodeData(layerIndex, i, forwardData, data, layers);
        node.updateData(nodeData);
        return node;
    });
}

function createNode(layerIndex, nodeIndex, x, y, radius, svg, popup, popupGroup, layers) {
    if (layerIndex === 0) {
        return new InputNode(x, y, radius, svg, nodeIndex, popup, popupGroup);
    } else if (layerIndex === layers.length - 1) {
        return new OutputNode(x, y, radius, svg, nodeIndex, layers.length, popup, popupGroup);
    } else {
        return new HiddenNode(x, y, radius, svg, layerIndex, nodeIndex, popup, popupGroup);
    }
}

function createLayerLinks(sourceNode, nodes, layers, lightsGroup, weights) {
    const nextLayerNodes = nodes.filter(node => node.layerIndex === sourceNode.layerIndex + 1);

    nextLayerNodes.forEach((targetNode, j) => {
        const weight = getWeightForLink(sourceNode, j, weights, layers);
        const randomColor = getRandomRedBlueColor(); // Generate a random mixed color

        const line = lightsGroup.append("line")
            .attr("x1", sourceNode.x)
            .attr("y1", sourceNode.y)
            .attr("x2", targetNode.x)
            .attr("y2", targetNode.y)
            .attr("stroke", randomColor) // Set the randomized stroke color
            .attr("stroke-width", LINK_DEFAULT_STROKE_WIDTH) // Use default stroke width variable
            .attr("class", `line-${sourceNode.layerIndex}-${sourceNode.i}-${targetNode.i}`)
            .attr("data-original-stroke", randomColor); // Store original color

        setupLinkHover(line, sourceNode, targetNode, weight, lightsGroup);

        links.push({ source: sourceNode, target: targetNode, line, weight });
    });
}

function getWeightForLink(sourceNode, targetNodeIndex, weights, layers) {
    if (sourceNode.layerIndex === 0 && weights?.input_weights) {
        return weights.input_weights[targetNodeIndex]?.[sourceNode.i] ?? null;
    } else if (sourceNode.layerIndex === layers.length - 2 && weights?.output_weights) {
        return weights.output_weights[targetNodeIndex]?.[sourceNode.i] ?? null;
    } else if (weights?.hidden_weights?.[sourceNode.layerIndex]) {
        return weights.hidden_weights[sourceNode.layerIndex]?.[targetNodeIndex]?.[sourceNode.i] ?? null;
    }
    return null;
}

function setupPopupHover(popup) {
    popup.on("mouseenter", () => {
        isOverPopup = true;
        clearTimeout(hidePopupTimeout);
    }).on("mouseleave", () => {
        isOverPopup = false;
        if (!isOverNode) hideNeuronPopup(popup);
    });
}

function setupLinkHover(line, sourceNode, targetNode, weight, lightsGroup) {
    line.on("mouseenter", function (event) {
        const originalColor = d3.select(this).attr("stroke");
        d3.select(this)
            .attr("stroke", LINK_HOVER_STROKE) // Use hover stroke color variable
            .attr("stroke-width", LINK_HOVER_STROKE_WIDTH) // Use hover stroke width variable
            .style("filter", LINK_HOVER_FILTER); // Use hover filter variable

        const weightText = weight !== null && !isNaN(weight) ? Number(weight).toFixed(4) : 'N/A';
        const tooltip = lightsGroup.append("text")
            .attr("x", (sourceNode.x + targetNode.x) / 2)
            .attr("y", (sourceNode.y + targetNode.y) / 2 - 10)
            .attr("fill", TOOLTIP_TEXT_COLOR) // Use tooltip text color variable
            .attr("font-size", TOOLTIP_FONT_SIZE) // Use tooltip font size variable
            .attr("text-anchor", TOOLTIP_TEXT_ANCHOR) // Use tooltip text anchor variable
            .text(`Weight: ${weightText}`);

        // Store tooltip reference for removal
        d3.select(this).attr("data-tooltip-id", `tooltip-${sourceNode.layerIndex}-${sourceNode.i}-${targetNode.i}`);

        d3.select(this).on("mouseleave", function () {
            d3.select(this)
                .attr("stroke", originalColor) // Revert to original color
                .attr("stroke-width", LINK_DEFAULT_STROKE_WIDTH) // Revert to default stroke width variable
                .style("filter", null);
            tooltip.remove();
        });
    });
}

export function updateNodesWithData(data, layers, percentile = 75) {
    // Collect all activation values for Hidden and Output nodes
    const activationValues = [];
    nodes.forEach(node => {
        if (node.layerIndex !== 0 && node.currentData && typeof node.currentData.activation === 'number') {
            activationValues.push(node.currentData.activation);
        }
    });

    // Define the desired percentile (e.g., top 25%)
    const sortedActivations = activationValues.sort(d3.ascending);
    const ACTIVATION_THRESHOLD = d3.quantile(sortedActivations, percentile / 100) || 0.5; // Fallback to 0.5 if undefined

    // Determine min and max for the color scale
    const minActivation = d3.min(activationValues) || 0;
    const maxActivation = d3.max(activationValues) || 1;

    // Update color scale with dynamic domain
    const dynamicColorScale = d3.scaleSequential()
        .interpolator(COLOR_SCALE_INTERPOLATOR)
        .domain([minActivation, maxActivation]);

    // Update each node with the calculated threshold and color scale
    nodes.forEach(node => {
        const nodeData = getNodeData(node.layerIndex, node.i, data.forward_data, data, layers);
        node.updateData(nodeData, ACTIVATION_THRESHOLD, dynamicColorScale);

        // If this node is currently being hovered over or its popup is displayed, update its popup
        if (node === currentHoveredNode || (popup.currentNode && node === popup.currentNode)) {
            updateNeuronPopup(popup, node.x, node.y, { 
                layerType: node.layerIndex === 0 ? "Input" : node.layerIndex === layers.length - 1 ? "Output" : "Hidden", 
                nodeIndex: node.i, 
                ...nodeData 
            });
        }
    });

    // Update link weights
    links.forEach(link => {
        const weight = getWeightForLink(link.source, link.target.i, data.weights_biases_data, layers);
        link.weight = weight;
    });
}

export function updateConnections(draggedNode) {
    links.forEach(link => {
        if (link.source === draggedNode || link.target === draggedNode) {
            link.line
                .attr("x1", link.source.x)
                .attr("y1", link.source.y)
                .attr("x2", link.target.x)
                .attr("y2", link.target.y);
        }
    });
}

export function animateDataFlow(data) {
    const svg = d3.select("svg");
    if (!Array.isArray(data)) data = [data];

    let epochIndex = 0;
    function animateEpoch() {
        if (epochIndex < data.length && !stopTraining) {
            const epochData = data[epochIndex];
            const forwardDuration = epochData.forward_data.forward_time * 1000;
            const backwardDuration = epochData.backward_data.backward_time * 1000;

            animateForwardPass(epochData.forward_data, svg, forwardDuration);
            animateBackwardPass(epochData.backward_data, svg, backwardDuration);
            updateLossChart(epochData.epoch, epochData.loss);

            epochIndex++;
            requestAnimationFrame(animateEpoch);
        }
    }

    requestAnimationFrame(animateEpoch);
}

export function animateForwardPass(forwardData, svg, duration) {
    const inputNodes = parseInt(document.getElementById('inputNodes').value);

    forwardData.input.forEach((inputBatch, batchIndex) => {
        inputBatch.forEach((input, index) => {
            if (index < inputNodes) {
                const inputNode = nodes.find(node => node.layerIndex === 0 && node.i === index);
                if (inputNode) {
                    animateLightThroughLayer(inputNode, forwardData.hidden_activation, duration * 50, svg, "forward");
                }
            }
        });
    });
}

export function animateBackwardPass(backwardData, svg, duration) {
    const hiddenNodes = nodes.filter(node => node.layerIndex === 1);
    const outputNodes = nodes.filter(node => node.layerIndex === 2);

    outputNodes.forEach(outputNode => {
        animateLightThroughLayer(outputNode, hiddenNodes, duration * 50, svg, "backward");
    });

    hiddenNodes.forEach(hiddenNode => {
        animateLightThroughLayer(hiddenNode, nodes.filter(node => node.layerIndex === 0), duration * 50, svg, "backward");
    });
}

export function animateLightThroughLayer(node, nextLayerData, duration, svg, direction) {
    const lightsGroup = svg.select(".lights-group");

    if (!node || typeof node.layerIndex === 'undefined') return;

    const nextLayerNodes = nodes.filter(n => n.layerIndex === node.layerIndex + 1);
    if (nextLayerNodes.length === 0) return;

    nextLayerNodes.forEach((targetNode, i) => {
        let line = svg.select(`.line-${node.layerIndex}-${node.i}-${targetNode.i}`);
        if (!line.empty()) {
            const light = lightsGroup.append("circle")
                .attr("r", 8)
                .attr("fill", LIGHT_FILL_COLOR) // Use light fill color variable
                .style("stroke", LIGHT_STROKE_COLOR) // Use light stroke color variable
                .style("stroke-width", LIGHT_STROKE_WIDTH); // Use light stroke width variable

            animateAlongLine(node.x, node.y, targetNode.x, targetNode.y, light, duration, svg, targetNode, direction);
        }
    });
}

function animateAlongLine(startX, startY, endX, endY, light, duration, svg, targetNode, direction) {
    const startTime = performance.now();

    function step(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;

        light.attr("transform", `translate(${currentX},${currentY})`);

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            light.remove();
            if (direction === "forward" && targetNode && targetNode.layerIndex < nodes.length - 1) {
                animateLightThroughLayer(targetNode, null, duration, svg, "forward");
            }
        }
    }

    requestAnimationFrame(step);
}

export function clearNetwork() {
    d3.select("#visualization").html("");
    nodes = [];
    links = [];
}

export function setCurrentHoveredNode(node) {
    currentHoveredNode = node;
}

export function clearCurrentHoveredNode() {
    currentHoveredNode = null;
}