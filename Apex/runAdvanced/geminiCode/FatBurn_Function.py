def calculate_running_fat_burn(
    distance_km: float, 
    weight_kg: float, 
    intensity: str = "Easy (Zone 2)"
) -> dict:
    """
    Calculates total energy expenditure and estimated fat burn in grams.
    
    Parameters:
    - distance_km (float): Distance run in kilometers.
    - weight_kg (float): Body weight in kilograms.
    - intensity (str): Intensity level ('Easy (Zone 2)', 'Moderate (Zone 3-4)', 'Hard / Intervals').
    
    Returns:
    - dict: Dictionary containing total calories, fat oxidation percentage, and fat burned in grams.
    """
    # Fat oxidation rate mapping based on exercise intensity
    intensity_map = {
        "easy": 0.65,
        "easy (zone 2)": 0.65,
        "zone 2": 0.65,
        "moderate": 0.50,
        "moderate (zone 3-4)": 0.50,
        "hard": 0.25,
        "hard / intervals": 0.25,
        "intervals": 0.25,
    }
    
    # Default to 0.50 if intensity string is not matched
    fat_oxidation_rate = intensity_map.get(intensity.strip().lower(), 0.50)
    
    # 1. Total energy expenditure (kcal)
    total_kcal = distance_km * weight_kg * 1.036
    
    # 2. Calories derived from fat
    fat_kcal = total_kcal * fat_oxidation_rate
    
    # 3. Grams of pure fat burned (9 kcal per gram of fat)
    fat_burned_grams = fat_kcal / 9.0
    
    return {
        "distance_km": distance_km,
        "weight_kg": weight_kg,
        "intensity": intensity,
        "fat_oxidation_rate": f"{int(fat_oxidation_rate * 100)}%",
        "total_calories_kcal": round(total_kcal, 1),
        "fat_calories_kcal": round(fat_kcal, 1),
        "fat_burned_grams": round(fat_burned_grams, 1),
    }


# Example Usage:
if __name__ == "__main__":
    run_summary = calculate_running_fat_burn(
        distance_km=10.0, 
        weight_kg=73.9, 
        intensity="Easy (Zone 2)"
    )
    print(run_summary)