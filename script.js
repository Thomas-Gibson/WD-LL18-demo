// --- DOM elements ---
const randomBtn = document.getElementById("random-btn");
const recipeDisplay = document.getElementById("recipe-display");

// This function creates a list of ingredients for the recipe from the API data
// It loops through the ingredients and measures, up to 20, and returns an HTML string
// that can be used to display them in a list format
// If an ingredient is empty or just whitespace, it skips that item 
function getIngredientsHtml(recipe) {
  let html = "";
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const meas = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) html += `<li>${meas ? `${meas} ` : ""}${ing}</li>`;
  }
  return html;
}

// --- Save and Display Favorite Recipes ---
// Helper: Get saved recipes from localStorage
function getSavedRecipes() {
  const saved = localStorage.getItem("savedRecipes");
  return saved ? JSON.parse(saved) : [];
}

// Helper: Save recipes to localStorage
function setSavedRecipes(recipes) {
  localStorage.setItem("savedRecipes", JSON.stringify(recipes));
}

// Render the saved recipes list above the main recipe display
function renderSavedRecipes() {
  const container = document.getElementById("saved-recipes-container");
  const list = document.getElementById("saved-recipes-list");
  const saved = getSavedRecipes();
  if (saved.length === 0) {
    container.style.display = "none";
    list.innerHTML = "";
    return;
  }
  container.style.display = "block";
  // Add clickable recipe names and Delete button for each saved recipe
  list.innerHTML = saved.map(name => `
    <li>
      <span class="saved-recipe-link" data-name="${name}" style="cursor:pointer; text-decoration:underline; color:#2a7ae2;">${name}</span>
      <button class="delete-btn" data-name="${name}">Delete</button>
    </li>
  `).join("");
  // Add event listeners for all delete buttons
  const deleteBtns = list.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const nameToDelete = btn.getAttribute("data-name");
      const updated = getSavedRecipes().filter(n => n !== nameToDelete);
      setSavedRecipes(updated);
      renderSavedRecipes();
    });
  });
  // Add event listeners for all recipe name links
  const recipeLinks = list.querySelectorAll(".saved-recipe-link");
  recipeLinks.forEach(link => {
    link.addEventListener("click", async () => {
      const recipeName = link.getAttribute("data-name");
      recipeDisplay.innerHTML = "<p>Loading recipe...</p>";
      try {
        // Fetch recipe details by name from MealDB
        const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(recipeName)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.meals && data.meals.length > 0) {
          window.currentRecipe = data.meals[0];
          renderRecipe(data.meals[0]);
          document.getElementById("remix-output").innerHTML = "";
        } else {
          recipeDisplay.innerHTML = `<p>Sorry, couldn't find that recipe.</p>`;
        }
      } catch (error) {
        recipeDisplay.innerHTML = `<p>Sorry, couldn't load the recipe.</p>`;
      }
    });
  });
}

// This function displays the recipe on the page
function renderRecipe(recipe) {
  recipeDisplay.innerHTML = `
    <div class="recipe-title-row">
      <h2>${recipe.strMeal}</h2>
    </div>
    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
    <h3>Ingredients:</h3>
    <ul>${getIngredientsHtml(recipe)}</ul>
    <h3>Instructions:</h3>
    <p>${recipe.strInstructions.replace(/\r?\n/g, "<br>")}</p>
    <button id="save-recipe-btn" class="main-btn">Save Recipe</button>
  `;
  // Add event listener for Save button
  const saveBtn = document.getElementById("save-recipe-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const saved = getSavedRecipes();
      if (!saved.includes(recipe.strMeal)) {
        saved.push(recipe.strMeal);
        setSavedRecipes(saved);
        renderSavedRecipes();
      }
    });
  }
}

// --- Remix Recipe Function ---
// This function sends the current recipe and remix theme to the AI and displays the remix
async function remixRecipe(recipe, theme) {
  const remixOutput = document.getElementById("remix-output");
  // Show a fun loading message while waiting for the AI
  remixOutput.innerHTML = "<p>Cooking your remix... 🪄🍳</p>";
  try {
    // Prepare the message for the AI
    const prompt = `Remix this recipe with the theme: "${theme}".\n\nRecipe JSON:\n${JSON.stringify(recipe, null, 2)}\n\nGive a short, fun, creative, and doable remix. Highlight any changed ingredients or instructions.`;

    // Send the prompt to your Cloudflare worker (which talks to OpenAI)
    const response = await fetch("https://openai.jtgibson.workers.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1", // Use the specified model
        messages: [
          { role: "system", content: "You are a creative chef AI that remixes recipes in fun, doable ways." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500
      })
    });

    // Parse the AI's response
    const data = await response.json();
    // Get the AI's reply text
    const aiText = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
      ? data.choices[0].message.content
      : "Sorry, I couldn't remix the recipe this time.";
    // Show the remix on the page, converting Markdown to HTML
    if (window.marked) {
      remixOutput.innerHTML = window.marked.parse(aiText);
    } else {
      remixOutput.innerHTML = `<p>${aiText.replace(/\n/g, "<br>")}</p>`;
    }
  } catch (error) {
    // Friendly error message
    remixOutput.innerHTML = "<p>Oops! Something went wrong with the remix. Please try again.</p>";
  }
}

// --- Hook up the Remix button ---
const remixBtn = document.getElementById("remix-btn");
const remixThemeSelect = document.getElementById("remix-theme");

remixBtn.addEventListener("click", async () => {
  // Find the current recipe displayed on the page
  // We'll store the last fetched recipe in a variable
  if (!window.currentRecipe) {
    document.getElementById("remix-output").innerHTML = "<p>Load a recipe first!</p>";
    return;
  }
  const theme = remixThemeSelect.value;
  await remixRecipe(window.currentRecipe, theme);
});

// --- Store the current recipe globally when fetched ---
async function fetchAndDisplayRandomRecipe() {
  recipeDisplay.innerHTML = "<p>Loading...</p>";
  try {
    const THE_MEALDB = "https://www.themealdb.com/api/json/v1/1/random.php";
    const res = await fetch(THE_MEALDB);
    const data = await res.json();
    const recipe = data.meals[0];
    window.currentRecipe = recipe; // Store globally for remixing
    renderRecipe(recipe);
    // Clear previous remix output
    document.getElementById("remix-output").innerHTML = "";
  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
    document.getElementById("remix-output").innerHTML = "";
  }
}

// This function gets a random recipe from the API and shows it
async function fetchAndDisplayRandomRecipe() {
  recipeDisplay.innerHTML = "<p>Cooking...</p>"; // Show loading message
  try {
    // Fetch a random recipe from the MealDB API
    const THE_MEALDB = "https://www.themealdb.com/api/json/v1/1/random.php"; // API URL for random recipes
    const res = await fetch(THE_MEALDB); // Replace with the actual API URL
    const data = await res.json(); // Parse the JSON response
    const recipe = data.meals[0]; // Get the first recipe from the response
    window.currentRecipe = recipe; // Store globally for remixing
    renderRecipe(recipe); // Render the recipe on the page
    // Clear previous remix output
    document.getElementById("remix-output").innerHTML = "";

  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
    document.getElementById("remix-output").innerHTML = "";
  }
}


// --- Event listeners ---

// When the button is clicked, get and show a new random recipe
randomBtn.addEventListener("click", fetchAndDisplayRandomRecipe);

// When the page loads, show a random recipe right away
document.addEventListener("DOMContentLoaded", () => {
  fetchAndDisplayRandomRecipe();
  renderSavedRecipes(); // Show saved recipes on load
});