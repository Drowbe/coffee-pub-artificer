import { CraftingWindow } from './window-crafting.js';
import { getPositionWithSavedBounds } from './window-bounds.js';

const RECIPE_BROWSER_APP_ID = 'artificer-recipes';
const RECIPE_BROWSER_BOUNDS_SETTING = 'windowBoundsRecipes';

export class RecipeBrowserWindow extends CraftingWindow {
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.mergeObject({}, super.DEFAULT_OPTIONS ?? {}), {
        id: RECIPE_BROWSER_APP_ID,
        classes: ['window-artificer-crafting', 'window-artificer-recipes', 'artificer-crafting-window', 'recipe-browser-window'],
        position: { width: 1100, height: 750 },
        window: { title: 'Artificer Recipe Browser', resizable: true, minimizable: true }
    });

    static PARTS = {
        body: {
            template: 'modules/coffee-pub-artificer/templates/window-recipes.hbs'
        }
    };

    constructor(options = {}) {
        const opts = foundry.utils.mergeObject({}, options);
        opts.id = opts.id ?? `${RECIPE_BROWSER_APP_ID}-${foundry.utils.randomID().slice(0, 8)}`;
        const defaultPos = RecipeBrowserWindow.DEFAULT_OPTIONS?.position ?? { width: 1100, height: 750 };
        opts.position = getPositionWithSavedBounds(defaultPos, RECIPE_BROWSER_BOUNDS_SETTING);
        super(opts);
    }

    _getBoundsSettingKey() {
        return RECIPE_BROWSER_BOUNDS_SETTING;
    }

    _getCrafterActor() {
        if (game.user?.isGM) {
            const controlled = canvas.ready ? canvas.tokens.controlled : [];
            const token = controlled[0];
            if (token?.actor) return token.actor;
        }
        return game.user?.character ?? null;
    }

    async getData(options = {}) {
        const data = await super.getData(options);
        return {
            ...data,
            canOpenInCraftingWindow: !!this.selectedRecipe,
            browserActionLabel: 'Open in Crafting Window'
        };
    }
}
