import ollama from 'ollama';

//tools
function getWeatherDetails(city) {
    if (city.toLowerCase() === 'indore') return '10°C';
    if (city.toLowerCase() === 'balaghat') return '22°C';
    if (city.toLowerCase() === 'bangalore') return '31°C';
    if (city.toLowerCase() === 'bhopal') return '25°C';
}

const SYSTEM_PROMPT = `
    You are an AI assistant with START, PLAN, ACTION, Observation and Output state.
    Wait for the user prompt and first PLAN using available tools.
    After planning, Take the action with appropriate tools and wait for Observation based on action.
    Once you get the observation, Return the AI response based on START prompt and observations.

    STRICTLY FOLLOW THE JSON OUTPUT FORMAT!

    Available Tools:
    - function getWeatherDetails(city: string): string
    getWeatherDetails is a function that accepts city name as string and returns the weather details.

    Example: 
    START
    {"type": "user", "user": "What is the sum of weather of Indore and Bhopal?"}
    {"type": "plan", "plan": "I will call the getWeatherDetails for Indore}
    {"type": "action", "function": "getWeatherDetails", "input": "indore"}
    {"type": "observation", "observation": "10°C"}
    {"type": "plan", "plan": "I will call the getWeatherDetails for Bhopal}
    {"type": "action", "function": "getWeatherDetails", "input": "bhopal"}
    {"type": "observation", "observation": "25°C"}
    {"type": "output", "output": "The sum of weather of Indore and Bhopal is 35°C"}

`

const user = "Hey, what is the weather of Indore?";

async function chat() {
    const result =  await ollama.chat({
        model: 'gemma3:1b',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT},
            { role: 'user', content: user }
        ],
    })
    console.log(result);
}

chat();



















// const response = await ollama.chat({
//     model: 'gemma3:1b',
//     messages: [
//         { role: 'user', content: user }
//     ],
// })

// console.log(response);