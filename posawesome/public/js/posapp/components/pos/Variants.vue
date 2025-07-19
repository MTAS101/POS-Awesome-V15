<template>
	<v-row justify="center">
		<v-dialog v-model="variantsDialog" max-width="600px">
			<v-card min-height="500px">
				<v-card-title>
					<span class="text-h5 text-primary">Select Item</span>
					<v-spacer></v-spacer>
					<v-btn color="error" theme="dark" @click="close_dialog">Close</v-btn>
				</v-card-title>
				<v-card-text class="pa-0">
					<v-container v-if="parentItem">
						<div v-for="attr in parentItem.attributes" :key="attr.attribute">
							<v-chip-group
								v-model="filters[attr.attribute]"
								selected-class="green--text text--accent-4"
								column
							>
								<v-chip
									v-for="value in attr.values"
									:key="value.abbr"
									:value="value.attribute_value"
									variant="outlined"
									label
									@click="updateFiltredItems"
								>
									{{ value.attribute_value }}
								</v-chip>
							</v-chip-group>
							<v-divider class="p-0 m-0"></v-divider>
						</div>
						<div>
							<v-row density="default" class="overflow-y-auto" style="max-height: 500px">
								<v-col
									v-for="(item, idx) in filterdItems"
									:key="idx"
									xl="2"
									lg="3"
									md="4"
									sm="4"
									cols="6"
									min-height="50"
								>
									<v-card hover="hover" @click="add_item(item)">
										<v-img
											:src="
												item.image ||
												'/assets/posawesome/js/posapp/components/pos/placeholder-image.png'
											"
											class="text-white align-end"
											gradient="to bottom, rgba(0,0,0,.2), rgba(0,0,0,.7)"
											height="100px"
										>
											<v-card-text
												v-text="item.item_name"
												class="text-subtitle-2 px-1 pb-2"
											></v-card-text>
										</v-img>
										<v-card-text class="text--primary pa-1">
											<div class="text-caption text-primary accent-3">
												{{ formatCurrency(item.price_list_rate || item.rate || 0) }}
												{{
													item.currency || (posProfile && posProfile.currency) || ""
												}}
											</div>
										</v-card-text>
									</v-card>
								</v-col>
							</v-row>
						</div>
					</v-container>
				</v-card-text>
			</v-card>
		</v-dialog>
	</v-row>
</template>

<script>
import format from "../../format";

export default {
	mixins: [format],
	data: () => ({
		variantsDialog: false,
		parentItem: null,
		items: null,
		filters: {},
		filterdItems: [],
		posProfile: null,
		priceList: null,
	}),

	computed: {
		variantsItems() {
			if (!this.parentItem || !Array.isArray(this.items)) {
				return [];
			}
			return this.items.filter((item) => item.variant_of == this.parentItem.item_code);
		},
	},

	watch: {
		items: {
			handler() {
				this.filterdItems = this.variantsItems;
			},
			deep: true,
		},
		parentItem() {
			this.filterdItems = this.variantsItems;
		},
	},

	methods: {
		close_dialog() {
			this.variantsDialog = false;
		},
		formatCurrency(value) {
			return this.$options.mixins[0].methods.formatCurrency.call(this, value, 2);
		},
		async fetchVariants(code, profile, priceList) {
			try {
				const posProfile = profile || this.posProfile || {};
				const list = priceList || this.priceList || posProfile.selling_price_list;
				const res = await frappe.call({
					method: "posawesome.posawesome.api.items.get_item_variants",
					args: {
						pos_profile: JSON.stringify(posProfile),
						parent_item_code: code,
						price_list: list,
						customer: posProfile.customer,
					},
				});
				if (res.message) {
					const itemsMap = {};
					(this.items || []).forEach((it) => {
						itemsMap[it.item_code] = it;
					});
					res.message.forEach((it) => {
						if (it.price_list_rate != null) {
							it.rate = it.price_list_rate;
						}
						if (itemsMap[it.item_code]) {
							Object.assign(itemsMap[it.item_code], it);
						} else {
							this.items = this.items || [];
							this.items.push(it);
						}
					});
					// Force array reactivity so UI updates with new prices
					this.items = [...this.items];
				}
			} catch (e) {
				console.error("Failed to fetch variants", e);
			}
		},
		updateFiltredItems() {
			this.$nextTick(function () {
				const values = [];
				Object.entries(this.filters).forEach(([key, value]) => {
					if (value) {
						values.push(value);
					}
				});

				if (!values.length) {
					this.filterdItems = this.variantsItems;
				} else {
					const itemsList = [];
					this.filterdItems = [];
					this.variantsItems.forEach((item) => {
						let apply = true;
						item.item_attributes.forEach((attr) => {
							if (
								this.filters[attr.attribute] &&
								this.filters[attr.attribute] != attr.attribute_value
							) {
								apply = false;
							}
						});
						if (apply && !itemsList.includes(item.item_code)) {
							this.filterdItems.push(item);
							itemsList.push(item.item_code);
						}
					});
				}
			});
		},
		add_item(item) {
			this.eventBus.emit("add_item", item);
			this.close_dialog();
		},
	},

	created: function () {
		this.eventBus.on("open_variants_model", async (item, items, profile, priceList) => {
			this.variantsDialog = true;
			this.posProfile = profile || null;
			this.priceList = priceList || null;
			this.parentItem = item || null;
			this.items = Array.isArray(items) ? items : [];
			this.filters = {};
			await this.fetchVariants(item.item_code, profile, priceList);
			// Ensure rate is populated for all variant items
			this.items.forEach((it) => {
				if (it.price_list_rate != null) {
					it.rate = it.price_list_rate;
				}
			});
			this.$nextTick(() => {
				this.filterdItems = this.variantsItems;
			});
		});
	},
	beforeUnmount() {
		this.eventBus.off("open_variants_model");
	},
};
</script>
