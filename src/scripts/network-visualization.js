
import { updateLossChart } from "./chart-logic.js";
import { stopTraining } from './event-handlers.js';
import { getNodeData, handleNeuronMouseover, handleNeuronMouseleave, createNeuronPopup, updateNeuronPopup, hideNeuronPopup} from './neuron/neuron-info.js';

let nodes = [];
let links = [];
let popup;
let isOverNode = false;
let isOverPopup = false;
let hidePopupTimeout;
let selectedNodeIndex = 0

export function drawNeuralNetwork(layers, weights, data) {

    console.log("Drawing neural network with layers:", layers);
    console.log("Received weights:", weights);
    d3.select("#visualization").html("");

    const svg = d3.select("#visualization").append("svg")
        .attr("width", window.innerWidth)
        .attr("height", window.innerHeight);

    // Create groups for lights and popup
    const lightsGroup = svg.append("g").attr("class", "lights-group");
    const popupGroup = svg.append("g").attr("class", "popup-group");

    const forwardData = data ? data.forward_data : null;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const layerSpacing = width / (layers.length + 1);
    const nodeRadius = 20;

    nodes = [];
    links = [];

    // Create the popup inside the popup group
    popup = createNeuronPopup(popupGroup);

    popup.on("mouseenter", () => {
        isOverPopup = true;
        clearTimeout(hidePopupTimeout);  // Cancel hide timeout when entering popup
    }).on("mouseleave", () => {
        isOverPopup = false;
        if (!isOverNode) {  // Only hide if the cursor is not over the node either
            hideNeuronPopup(popup);
        }
    });

    layers.forEach((layerSize, layerIndex) => {
        const x = layerSpacing * (layerIndex + 1);
        const ySpacing = height / (layerSize + 1);

        let layerType;
        if (layerIndex === 0) {
            layerType = "Input";
        } else if (layerIndex === layers.length - 1) {
            layerType = "Output";
        } else {
            layerType = `Hidden Layer ${layerIndex}`;
        }

        for (let i = 0; i < layerSize; i++) {
            const y = ySpacing * (i + 1);

            let strokeColor;
            if (layerIndex === 0) {
                // Input layer
                strokeColor = "rgba(57, 255, 20, 1)";  // Neon Green for outer ring
            } else if (layerIndex === layers.length - 1) {
                // Output layer
                strokeColor = "rgba(255, 7, 58, 1)";  // Neon Red for outer ring
            } else {
                // Hidden layers
                strokeColor = "rgba(255, 255, 51, 1)";  // Neon Yellow for outer ring
            }
            
            // Set the color for each node with neon stroke (outer ring) and neutral fill
            const node = svg.append("circle")
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", nodeRadius)
                .style("fill", "rgba(255, 255, 255, 0.1)")  // Neutral fill color
                .style("stroke", "rgba(0, 255, 255, 1)")  // Neon blue stroke
                .style("stroke-width", "4px")  // Thicker stroke for neon effect
                .style("filter", "drop-shadow(0 0 15px rgba(0, 100, 255, 1))")  // Neon glow effect
                .call(d3.drag()
                    .on("start", dragStarted)
                    .on("drag", dragged)
                    .on("end", dragEnded)
                )
                .on("mouseenter", function (event) {
                    isOverNode = true;  // Track when the cursor is over the node
                    clearTimeout(hidePopupTimeout);  // Prevent hiding the popup when hovering over the node
                    const nodeData = getNodeData(layerIndex, i, forwardData, data, layers);
                    handleNeuronMouseover(popupGroup, popup, event, layerType, i, nodeData);
                })
                .on("mouseleave", function (event) {
                    isOverNode = false;  // Reset the node hover flag
                    if (!isOverPopup) {  // Only hide the popup if not over the popup
                        hidePopupTimeout = setTimeout(() => {
                            hideNeuronPopup(popup);
                        }, 100);  // Delay hiding to allow transition to popup
                    }
                    handleNeuronMouseleave(popup, event);  // Handles popup hide and neuron styling reset
                });
            nodes.push({ layerIndex, i, x, y, node: node.node(), layerType });
        }
    });

    // Create links (connections between nodes in adjacent layers)
    nodes.forEach(sourceNode => {
        if (sourceNode.layerIndex < layers.length - 1) {
            const nextLayerNodes = nodes.filter(node => node.layerIndex === sourceNode.layerIndex + 1);

            nextLayerNodes.forEach((targetNode, j) => {
                let weight;
                if (sourceNode.layerIndex === 0 && weights && weights.input_weights) {
                    weight = weights.input_weights[j] ? weights.input_weights[j][sourceNode.i] : null;
                } else if (sourceNode.layerIndex === layers.length - 2 && weights && weights.output_weights) {
                    weight = weights.output_weights[j] ? weights.output_weights[j][sourceNode.i] : null;
                } else if (weights && weights.hidden_weights && weights.hidden_weights[sourceNode.layerIndex]) {
                    weight = weights.hidden_weights[sourceNode.layerIndex][j] ? weights.hidden_weights[sourceNode.layerIndex][j][sourceNode.i] : null;
                }

                const line = lightsGroup.append("line")  // Use lightsGroup for line creation
                .attr("x1", sourceNode.x)
                .attr("y1", sourceNode.y)
                .attr("x2", targetNode.x)
                .attr("y2", targetNode.y)
                .attr("stroke", "rgba(255, 0, 85, 1)")  // Neon red color
                .attr("stroke-width", 2)
                .attr("class", `line-${sourceNode.layerIndex}-${sourceNode.i}-${targetNode.i}`);
            
            // On mouseenter, add a glow effect
            line.on("mouseenter", function(event) {
                d3.select(this)
                    .attr("stroke", "rgba(255, 0, 85, 1)")  // Keep neon red
                    .attr("stroke-width", 4)  // Make the line thicker
                    .style("filter", "drop-shadow(0 0 10px rgba(255, 0, 85, 1))");  // Add the glow effect
            
                let weightText = weight !== null && !isNaN(weight) ? Number(weight).toFixed(4) : 'N/A';
            
                const tooltip = svg.append("text")
                    .attr("x", (sourceNode.x + targetNode.x) / 2)
                    .attr("y", (sourceNode.y + targetNode.y) / 2 - 10)
                    .attr("fill", "white")
                    .attr("font-size", "14px")
                    .attr("text-anchor", "middle")
                    .text(`Weight: ${weightText}`);
            
                d3.select(this).on("mouseleave", function() {
                    d3.select(this)
                        .attr("stroke", "rgba(255, 0, 85, 1)")  // Keep neon red
                        .attr("stroke-width", 2)  // Reset stroke width
                        .style("filter", null);  // Remove the glow effect
            
                    tooltip.remove();
                });
            });

                links.push({ source: sourceNode, target: targetNode, line, weight });
            });
        }
    });
}

export function dragStarted(event, d) {
    d3.select(this).raise().attr("stroke", "black");
    const draggedNode = nodes.find(n => n.node === this);
    if (draggedNode) {
        updateNeuronPopup(popup, event.sourceEvent.pageX, event.sourceEvent.pageY, {
            layerType: draggedNode.layerType,
            nodeIndex: draggedNode.i,
            weight: 'N/A',
            bias: 'N/A',
            activation: 'N/A',
            gradient: 'N/A',
            backpropHistory: []
        });
        popup.style("display", "block");
    }
}

export function dragged(event, d) {
    const draggedNode = nodes.find(n => n.node === this);

    if (!draggedNode) {
        console.error("Dragged node not found.");
        return;
    }

    // Move the node
    d3.select(this)
        .attr("cx", event.x)
        .attr("cy", event.y);

    // Update the node's position in the global nodes array
    draggedNode.x = event.x;
    draggedNode.y = event.y;

    // Update the connections as the node is dragged
    updateConnections(draggedNode);

    // Update the popup position
    updateNeuronPopup(popup, event.sourceEvent.pageX, event.sourceEvent.pageY, {
        layerType: draggedNode.layerType,
        nodeIndex: draggedNode.i,
        weight: 'N/A',
        bias: 'N/A',
        activation: 'N/A',
        gradient: 'N/A',
        backpropHistory: []
    });
}

export function dragEnded(event, d) {
    d3.select(this).attr("stroke", "white");
    if (!isOverPopup) {
        hideNeuronPopup(popup);
    }
    
    // Re-enable pointer events on the lines
    d3.selectAll("line").style("pointer-events", "auto");
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
    console.log("Received data in animateDataFlow:", data); // Log the data
    const svg = d3.select("svg");

    // If data is not an array, process it as a single object
    if (!Array.isArray(data)) {
        data = [data];  // Convert to array
        console.log("Data is not an array, converting:", data);
    }

    data.forEach((epochData, index) => {
        console.log(`Processing epoch ${index + 1}:`, epochData);

        if (stopTraining) return;

        const forwardDuration = epochData.forward_data.forward_time * 1000; // Adjust duration as needed
        const backwardDuration = epochData.backward_data.backward_time * 1000; // Adjust duration as needed

        console.log(`Triggering forward pass for epoch ${index + 1}, duration: ${forwardDuration}`);
        animateForwardPass(epochData.forward_data, svg, forwardDuration);

        console.log(`Triggering backward pass for epoch ${index + 1}, duration: ${backwardDuration}`);
        animateBackwardPass(epochData.backward_data, svg, backwardDuration);

        console.log(`Updating loss chart for epoch ${index + 1}, loss: ${epochData.loss}`);
        updateLossChart(epochData.epoch, epochData.loss);
    });
}

export function animateForwardPass(forwardData, svg, duration) {
    const inputNodes = parseInt(document.getElementById('inputNodes').value);  // Dynamically get the number of input nodes
    console.log("Animating forward pass with input nodes:", inputNodes);

    // Loop through each batch (array) in the input
    forwardData.input.forEach((inputBatch, batchIndex) => {
        console.log(`Animating batch ${batchIndex + 1} with ${inputBatch.length} inputs`);

        inputBatch.forEach((input, index) => {
            if (index >= inputNodes) {
                console.warn(`Skipping input node ${index}, expected ${inputNodes}`);
                return;
            }

            const inputNode = nodes.find(node => node.layerIndex === 0 && node.i === index);

            if (!inputNode) {
                console.warn(`Input node not found for index ${index}`);
                return;
            }

            console.log(`Animating light from input node ${index} in batch ${batchIndex}, value: ${input}`);
            animateLightThroughLayer(inputNode, forwardData.hidden_activation, duration * 50, svg, "forward");
        });
    });

    console.log(`Received input batches: ${forwardData.input.length}, expected: ${inputNodes}`);
}

// Animation for backward pass
export function animateBackwardPass(backwardData, svg, duration) {
    const hiddenNodes = nodes.filter(node => node.layerIndex === 1);
    const outputNodes = nodes.filter(node => node.layerIndex === 2);

    outputNodes.forEach((outputNode, i) => {
        animateLightThroughLayer(outputNode, hiddenNodes, duration * 50, svg, "backward");
    });

    hiddenNodes.forEach((hiddenNode, i) => {
        animateLightThroughLayer(hiddenNode, nodes.filter(node => node.layerIndex === 0), duration * 50, svg, "backward");
    });
}

// Function to animate light through the layer without using getPointAtLength
// Updated animateLightThroughLayer to use lightsGroup for light circles
export function animateLightThroughLayer(node, nextLayerData, duration, svg, direction) {
    const lightsGroup = svg.select(".lights-group"); // Use the lights group for all lights

    // Ensure the node is valid
    if (!node || typeof node.layerIndex === 'undefined') {
        console.error("Invalid node or missing layerIndex", node);
        return;
    }

    // Check if the node is in the last layer
    if (node.layerIndex >= Math.max(...nodes.map(n => n.layerIndex))) {
        console.warn("Node is in the last layer, no further layers to animate.");
        return;  // Exit the function if there is no next layer
    }

    // Filter for the nodes in the next layer
    const nextLayerNodes = nodes.filter(n => n.layerIndex === node.layerIndex + 1);

    if (nextLayerNodes.length === 0) {
        console.warn("No nodes found in the next layer", node.layerIndex + 1);
        return;  // If there are no nodes in the next layer, exit the function
    }

    // Animate the connection between this node and the nodes in the next layer
    nextLayerNodes.forEach((targetNode, i) => {
        if (!targetNode || typeof targetNode.layerIndex === 'undefined') {
            console.error("Invalid target node or missing layerIndex", targetNode);
            return;
        }

        // Create or update the line
        let path = svg.select(`.line-${node.layerIndex}-${i}-${targetNode.i}`);
        if (path.empty()) {
            path = lightsGroup.append("line")  // Use lightsGroup for the line
                .attr("x1", node.x)
                .attr("y1", node.y)
                .attr("x2", targetNode.x)
                .attr("y2", targetNode.y)
                .attr("stroke", "rgba(255, 255, 255, 0.3)")  // Soft, subtle line
                .attr("stroke-width", 6);
        }

        const light = lightsGroup.append("circle")  // Append the light to lightsGroup
            .attr("r", 8)
            .attr("fill", "rgba(255, 255, 255, 0.9)")  // Bright white color for the light
            .style("stroke", "rgba(200, 200, 200, 0.7)")  // Light gray stroke for a soft glow
            .style("stroke-width", 6);  // Glow effect with a wider stroke

        // Function to manually interpolate the light along the line
        const animateAlongLine = (startX, startY, endX, endY, light, duration) => {
            light.transition()
                .duration(duration)
                .ease(d3.easeLinear)
                .attrTween("transform", function () {
                    return function (t) {
                        const currentX = startX + (endX - startX) * t;
                        const currentY = startY + (endY - startY) * t;
                        return `translate(${currentX},${currentY})`;
                    };
                })
                .on("end", function () {
                    d3.select(this).remove();  // Remove the light once the animation is complete

                    // Recursive call for the next layer's animation
                    if (direction === "forward" && targetNode && targetNode.layerIndex < nodes.length - 1) {
                        animateLightThroughLayer(targetNode, nextLayerData, duration, svg, "forward");
                    }
                });
        };

        // Animate the light along the line
        animateAlongLine(node.x, node.y, targetNode.x, targetNode.y, light, duration);
    });
}

// Function to clear the neural network visualization
export function clearNetwork() {
    d3.select("#visualization").html(""); // Clear the SVG area
    nodes = [];
    links = [];
}

