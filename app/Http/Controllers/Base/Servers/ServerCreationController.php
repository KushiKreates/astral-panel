<?php

namespace Pterodactyl\Http\Controllers\Base\Servers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use Pterodactyl\Models\Nest;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\Servers\ServerCreationService;
use Illuminate\Support\Facades\Log;

class ServerCreationController extends Controller
{
    public function __construct(
        private ServerCreationService $creationService
    ) {}

    public function index()
{
    $user = auth()->user();
    $activePlan = $user->purchases_plans['Free Tier'];
    
    if (!$activePlan) {
        throw new DisplayException('No active plan found');
    }

    // Get locations with available nodes
    $locations = Location::with(['nodes' => function($query) {
        $query->select(['id', 'name', 'location_id'])
            ->where('public', true);
    }])->get()->filter(function($location) use ($activePlan) {
        return $location->nodes->count() > 0 
            && $location->userHasRequiredPlan([$activePlan['name']])
            && !$location->hasReachedMaximumServers();
    });

    $eggs = Nest::with(['eggs' => function($query) {
        $query->whereRaw("LOWER(description) LIKE '%server_ready%'")
            ->select(['id', 'nest_id', 'name', 'description', 'image_url']);
    }])->get();

    return Inertia::render('Dash/Deploy/ServerCreate', [
        'plan' => $activePlan,
        'eggs' => $eggs,
        'locations' => $locations,
        'limits' => [
            'cpu' => $activePlan['cpu'],
            'memory' => $activePlan['memory'],
            'disk' => $activePlan['disk'],
            'servers' => $activePlan['servers'],
            'allocations' => $activePlan['allocations'],
            'databases' => $activePlan['databases'],
            'backups' => $activePlan['backups']
        ]
    ]);
}

public function store(Request $request)
{
    try {
        $user = auth()->user();
        
        $validated = $request->validate([
            'name' => 'required|string|min:3',
            'egg_id' => 'required|exists:eggs,id',
            'location_id' => 'required|exists:locations,id',
            'plan_name' => 'required|string'
        ]);

        $planName = $validated['plan_name'];

        // Check if user has purchased this plan
        if (!isset($user->purchases_plans[$planName])) {
            throw new DisplayException("You don't own the {$planName} plan! Please purchase it first. If you belive this is a mistake please contact a staff member.");
        }

        // Get plan from database
        $plan = \Pterodactyl\Models\Plan::where('name', $planName)->first();
        if (!$plan) {
            throw new DisplayException('Plan not found in database.');
        }

        // Verify location requirements
        $location = Location::findOrFail($validated['location_id']);
        if (!empty($location->required_plans) && !in_array($planName, $location->required_plans)) {
            throw new DisplayException("The selected plan doesn't meet the location requirements");
        }

        // Check if location has reached maximum servers
        if ($location->hasReachedMaximumServers()) {
            throw new DisplayException('This location has reached its maximum server capacity');
        }

        



        // The below code looks for count of plans, This has been removed as we are not using it. user will be given a completely different plan.
        // Check purchase limit
        //$purchasedPlanCount = $user->purchases_plans[$planName]['count'] ?? 1;
        //if (count($activatedPlans) >= $purchasedPlanCount) {
            //throw new DisplayException("No more {$planName} plans available to activate");
        //}

        $purchasedPlan = $user->purchases_plans[$planName] ?? null;
        if (!$purchasedPlan) {
            throw new DisplayException("You have not purchased the {$planName} plan");
        }

        // Count how many times this plan is activated
        // Get purchased plan count
        $purchasedPlanCount = isset($user->purchases_plans[$planName]) 
            ? $user->purchases_plans[$planName]['count'] 
            : 0;

// Get count of activated instances of this plan
        $activatedPlans = $user->activated_plans ?? [];
        $activatedPlanCount = isset($activatedPlans[$planName]) 
            ? $activatedPlans[$planName]['count'] 
            : 0;

// Check if user has reached their activation limit
        if ($activatedPlanCount >= $purchasedPlanCount) {
            throw new DisplayException("You have reached the maximum activations for {$planName} plan ({$purchasedPlanCount} allowed)");
        }

// Continue with server creation...

        // Get random node from location
        $node = $location->nodes()
            ->where('public', true)
            ->inRandomOrder()
            ->firstOrFail();

        $egg = \Pterodactyl\Models\Egg::find($validated['egg_id']);
        if (!$egg) {
            throw new DisplayException('Invalid egg configuration');
        }

        // Get docker image
        $dockerImages = array_values($egg->docker_images);
        $dockerImage = $dockerImages[array_rand($dockerImages)];
        if (!$dockerImage) {
            throw new DisplayException('No valid docker image found for this egg');
        }

        // Get variables
        $variables = $egg->variables->transform(function($item) {
            return [
                $item->env_variable => $item->default_value ?? '',
            ];
        })->mapWithKeys(function ($item) {
            return $item;
        })->toArray();

        // Get allocation
        $allocation = Allocation::query()
            ->whereNull('server_id')
            ->where('node_id', $node->id)
            ->inRandomOrder()
            ->first();

        if (!$allocation) {
            throw new DisplayException('No available allocations found');
        }

            // Update activated plans
        if (isset($activatedPlans[$planName])) {
            $activatedPlans[$planName]['count'] = ($activatedPlans[$planName]['count'] ?? 0) + 1;
        } else {
            $activatedPlans[$planName] = [
                'plan_id' => $plan->id,
                'name' => $plan->name,
                'count' => 1,
                'activated_on' => now()->toDateTimeString()
            ];
        }

        $user->update([
            'activated_plans' => $activatedPlans
        ]);
        
        

        // Create server
        $server = $this->creationService->handle([
            'name' => $validated['name'],
            'owner_id' => $user->id,
            'egg_id' => $validated['egg_id'],
            'node_id' => $node->id,
            'allocation_id' => $allocation->id,
            'cpu' => $plan->cpu,
            'memory' => $plan->memory,
            'disk' => $plan->disk,
            'database_limit' => $plan->databases,
            'allocation_limit' => $plan->allocations,
            'backup_limit' => $plan->backups,
            'environment' => $variables,
            'swap' => 0,
            'io' => 500,
            'startup' => $egg->startup,
            'image' => $dockerImage,
            'skip_scripts' => false,
            'oom_disabled' => true,
            'plan' => [
                $planName => [
                'activated_on' => now()->toDateTimeString(),
                'expires_at' => $planName === 'Free Tier' ? now()->addDays(7)->toDateTimeString() : now()->addDays(30)->toDateTimeString()
            ]
]
        ]);

        

        return back()->with('success', [
            'title' => 'Server Created Successfully',
            'desc' => "Your server {$validated['name']} has been created and is being installed."
        ]);

    } catch (DisplayException $e) {
        return back()->with('error', [
            'title' => 'Server Creation Failed',
            'desc' => $e->getMessage()
        ]);
    }
}
}




