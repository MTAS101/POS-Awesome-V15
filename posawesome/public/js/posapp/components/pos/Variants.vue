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
									>{{ value.attribute_value }}</v-chip
								>
							</v-chip-group>
							<v-divider class="p-0 m-0"></v-divider>
						</div>
						<div>
							<v-row density="default" class="overflow-y-auto" style="max-height: 500px">
								<v-col
									v-for="(item, idx) in displayVariants"
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
												{{
													currencySymbol(
														item.currency ||
															(posProfile && posProfile.currency) ||
															"",
													)
												}}
												{{ formatCurrency(item.rate ?? item.price_list_rate ?? 0) }}
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
	data() {
		return {
			variantsDialog: false,
			parentItem: null,
			variants: [],
			filters: {},
			posProfile: null,
			priceList: null,
		};
	},
	computed: {
		displayVariants() {
			const active = Object.entries(this.filters).filter(([k, v]) => v);
			if (!active.length) {
				return this.variants;
			}
			return this.variants.filter((item) => {
				return active.every(([key, val]) => {
					const attrs = Array.isArray(item.item_attributes) ? item.item_attributes : [];
					const attr = attrs.find((a) => a.attribute === key);
					return attr && attr.attribute_value === val;
				});
			});
		},
	},
	methods: {
		close_dialog() {
			this.variantsDialog = false;
		},
		async fetchVariants(code, profile, priceList) {
			try {
				const posProfile = profile || this.posProfile || {};
				const list = priceList || this.priceList || posProfile.selling_price_list;

				if (!Array.isArray(this.variants)) {
					this.variants = [];
				}

				const itemsMap = {};
				this.variants.forEach((it) => {
					itemsMap[it.item_code] = it;
				});
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
					res.message.forEach((it) => {
						if (it.price_list_rate != null) {
							it.rate = it.price_list_rate;
						}
						if (itemsMap[it.item_code]) {
							Object.assign(itemsMap[it.item_code], it);
						} else {
							this.variants.push(it);
						}
					});

					// If any variant lacks rate information, fetch it directly
					if (list) {
						await Promise.all(
							this.variants.map(async (v) => {
								if (!v.rate) {
									try {
										const r = await frappe.call({
											method: "posawesome.posawesome.api.items.get_price_for_uom",
											args: {
												item_code: v.item_code,
												price_list: list,
												uom: v.stock_uom,
											},
										});
										if (r.message) {
											v.rate = r.message;
											v.price_list_rate = r.message;
										}
									} catch (err) {
										console.error("Failed to fetch price", err);
									}
								}
							}),
						);
					}

					this.variants = [...this.variants];
				}
			} catch (e) {
				console.error("Failed to fetch variants", e);
			}
		},
		add_item(item) {
			this.eventBus.emit("add_item", item);
			this.close_dialog();
		},
	},
	created() {
		this.eventBus.on("open_variants_model", async (item, items, profile, priceList) => {
			this.variantsDialog = true;
			this.posProfile = profile || null;
			this.priceList = priceList || null;
			this.parentItem = item || null;
			this.variants = Array.isArray(items) ? items : [];
			this.filters = {};
			if (item) {
				await this.fetchVariants(item.item_code, profile, priceList);
			}
		});
	},
	beforeUnmount() {
		this.eventBus.off("open_variants_model");
	},
};
</script>
